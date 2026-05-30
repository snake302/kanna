import type {
  AskUserQuestionItem,
  AskUserQuestionAnswerMap,
  AskUserQuestionToolResult,
  ExitPlanModeToolResult,
  HydratedToolCall,
  NormalizedToolCall,
  ReadFileToolResult,
  SubagentTaskAgentState,
  SubagentTaskInput,
  TodoItem,
} from "./types"

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function optionalString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string") return value
  }
  return undefined
}

function optionalStringOrNull(record: Record<string, unknown>, ...keys: string[]): string | null | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" || value === null) return value
  }
  return undefined
}

function optionalStringArray(record: Record<string, unknown>, ...keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      const strings = value.filter((entry): entry is string => typeof entry === "string")
      if (strings.length === value.length) return strings
    }
  }
  return undefined
}

function normalizeSubagentStates(value: unknown): Record<string, SubagentTaskAgentState> | undefined {
  const record = asRecord(value)
  if (!record) return undefined

  const states: Record<string, SubagentTaskAgentState> = {}
  for (const [threadId, state] of Object.entries(record)) {
    const stateRecord = asRecord(state)
    if (!stateRecord) continue
    const status = stateRecord.status
    if (typeof status !== "string") continue
    states[threadId] = {
      status,
      message: optionalStringOrNull(stateRecord, "message"),
    }
  }

  return Object.keys(states).length > 0 ? states : undefined
}

export function normalizeSubagentTaskInput(input: Record<string, unknown>): SubagentTaskInput {
  return {
    subagentType: optionalString(input, "subagent_type", "subagentType")
      ?? (input.type === "collabAgentToolCall" ? optionalString(input, "tool") : undefined),
    status: optionalString(input, "status"),
    senderThreadId: optionalString(input, "senderThreadId", "sender_thread_id"),
    receiverThreadIds: optionalStringArray(input, "receiverThreadIds", "receiver_thread_ids"),
    prompt: optionalStringOrNull(input, "prompt"),
    agentsStates: normalizeSubagentStates(input.agentsStates ?? input.agents_states),
  }
}

export function normalizeToolCall(args: {
  toolName: string
  toolId: string
  input: Record<string, unknown>
}): NormalizedToolCall {
  const { toolName, toolId, input } = args

  switch (toolName) {
    case "AskUserQuestion":
      return {
        kind: "tool",
        toolKind: "ask_user_question",
        toolName,
        toolId,
        input: {
          questions: Array.isArray(input.questions) ? (input.questions as AskUserQuestionItem[]) : [],
        },
        rawInput: input,
      }
    case "ExitPlanMode":
      return {
        kind: "tool",
        toolKind: "exit_plan_mode",
        toolName,
        toolId,
        input: {
          plan: typeof input.plan === "string" ? input.plan : undefined,
          summary: typeof input.summary === "string" ? input.summary : undefined,
        },
        rawInput: input,
      }
    case "TodoWrite":
      return {
        kind: "tool",
        toolKind: "todo_write",
        toolName,
        toolId,
        input: {
          todos: Array.isArray(input.todos) ? (input.todos as TodoItem[]) : [],
        },
        rawInput: input,
      }
    case "Skill":
      return {
        kind: "tool",
        toolKind: "skill",
        toolName,
        toolId,
        input: {
          skill: typeof input.skill === "string" ? input.skill : "",
        },
        rawInput: input,
      }
    case "Glob":
      return {
        kind: "tool",
        toolKind: "glob",
        toolName,
        toolId,
        input: {
          pattern: typeof input.pattern === "string" ? input.pattern : "",
        },
        rawInput: input,
      }
    case "Grep":
      return {
        kind: "tool",
        toolKind: "grep",
        toolName,
        toolId,
        input: {
          pattern: typeof input.pattern === "string" ? input.pattern : "",
          outputMode: typeof input.output_mode === "string" ? input.output_mode : undefined,
        },
        rawInput: input,
      }
    case "Bash":
      return {
        kind: "tool",
        toolKind: "bash",
        toolName,
        toolId,
        input: {
          command: typeof input.command === "string" ? input.command : "",
          description: typeof input.description === "string" ? input.description : undefined,
          timeoutMs: typeof input.timeout === "number" ? input.timeout : undefined,
          runInBackground: Boolean(input.run_in_background),
        },
        rawInput: input,
      }
    case "WebSearch":
      return {
        kind: "tool",
        toolKind: "web_search",
        toolName,
        toolId,
        input: {
          query: typeof input.query === "string" ? input.query : "",
        },
        rawInput: input,
      }
    case "Read":
      return {
        kind: "tool",
        toolKind: "read_file",
        toolName,
        toolId,
        input: {
          filePath: typeof input.file_path === "string" ? input.file_path : "",
        },
        rawInput: input,
      }
    case "Write":
      return {
        kind: "tool",
        toolKind: "write_file",
        toolName,
        toolId,
        input: {
          filePath: typeof input.file_path === "string" ? input.file_path : "",
          content: typeof input.content === "string" ? input.content : "",
        },
        rawInput: input,
      }
    case "Edit":
      return {
        kind: "tool",
        toolKind: "edit_file",
        toolName,
        toolId,
        input: {
          filePath: typeof input.file_path === "string" ? input.file_path : "",
          oldString: typeof input.old_string === "string" ? input.old_string : "",
          newString: typeof input.new_string === "string" ? input.new_string : "",
        },
        rawInput: input,
      }
  }

  const mcpMatch = toolName.match(/^mcp__(.+?)__(.+)$/)
  if (mcpMatch) {
    return {
      kind: "tool",
      toolKind: "mcp_generic",
      toolName,
      toolId,
      input: {
        server: mcpMatch[1],
        tool: mcpMatch[2],
        payload: input,
      },
      rawInput: input,
    }
  }

  const subagentInput = normalizeSubagentTaskInput(input)
  if (subagentInput.subagentType) {
    return {
      kind: "tool",
      toolKind: "subagent_task",
      toolName,
      toolId,
      input: subagentInput,
      rawInput: input,
    }
  }

  return {
    kind: "tool",
    toolKind: "unknown_tool",
    toolName,
    toolId,
    input: {
      payload: input,
    },
    rawInput: input,
  }
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

type ReadStructuredTextBlock = {
  type: "text"
  text: string
}

type ReadStructuredImageBlock = {
  type: "image"
  data: string
  mimeType?: string
}

function normalizeReadBlocks(value: unknown): Array<ReadStructuredTextBlock | ReadStructuredImageBlock> {
  const blocks = (
    value
    && typeof value === "object"
    && "content" in value
    && Array.isArray((value as { content?: unknown }).content)
  )
    ? (value as { content: unknown[] }).content
    : Array.isArray(value)
      ? value
      : []

  const normalized: Array<ReadStructuredTextBlock | ReadStructuredImageBlock> = []

  for (const block of blocks) {
    if (!block || typeof block !== "object" || !("type" in block)) {
      continue
    }

    if (block.type === "text" && typeof block.text === "string") {
      normalized.push({ type: "text", text: block.text })
      continue
    }

    if (block.type === "image") {
      if ("data" in block && typeof block.data === "string") {
        normalized.push({
          type: "image",
          data: block.data,
          mimeType: typeof block.mimeType === "string" ? block.mimeType : undefined,
        })
        continue
      }

      if (
        "source" in block
        && block.source
        && typeof block.source === "object"
        && "type" in block.source
        && block.source.type === "base64"
        && "data" in block.source
        && typeof block.source.data === "string"
      ) {
        normalized.push({
          type: "image",
          data: block.source.data,
          mimeType: typeof block.source.media_type === "string" ? block.source.media_type : undefined,
        })
      }
    }
  }

  return normalized
}

export function hydrateToolResult(tool: NormalizedToolCall, raw: unknown): HydratedToolCall["result"] {
  const parsed = parseJsonValue(raw)

  switch (tool.toolKind) {
    case "ask_user_question": {
      const record = asRecord(parsed)
      const answers = asRecord(record?.answers) ?? (record ? record : {})
      return {
        answers: Object.fromEntries(
          Object.entries(answers).map(([key, value]) => {
            if (Array.isArray(value)) {
              return [key, value.map((entry) => String(entry))]
            }
            if (value && typeof value === "object" && Array.isArray((value as { answers?: unknown }).answers)) {
              return [key, (value as { answers: unknown[] }).answers.map((entry) => String(entry))]
            }
            if (value == null || value === "") {
              return [key, []]
            }
            return [key, [String(value)]]
          })
        ) as AskUserQuestionAnswerMap,
        ...(record?.discarded === true ? { discarded: true } : {}),
      } satisfies AskUserQuestionToolResult
    }
    case "exit_plan_mode": {
      const record = asRecord(parsed)
      return {
        confirmed: typeof record?.confirmed === "boolean" ? record.confirmed : undefined,
        clearContext: typeof record?.clearContext === "boolean" ? record.clearContext : undefined,
        message: typeof record?.message === "string" ? record.message : undefined,
        ...(record?.discarded === true ? { discarded: true } : {}),
      } satisfies ExitPlanModeToolResult
    }
    case "read_file":
      if (typeof parsed === "string") {
        return parsed
      }
      const blocks = normalizeReadBlocks(parsed)
      if (blocks.length > 0) {
        return {
          content: blocks
            .flatMap((block) => block.type === "text" ? [block.text] : [])
            .join(""),
          blocks,
        } satisfies ReadFileToolResult
      }

      const record = asRecord(parsed)
      return {
        content: typeof record?.content === "string" ? record.content : JSON.stringify(parsed, null, 2),
      } satisfies ReadFileToolResult
    default:
      return parsed
  }
}
