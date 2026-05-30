import { UserRound, X } from "lucide-react"
import type { ProcessedToolCall } from "./types"
import { MetaRow, MetaLabel, MetaCodeBlock, ExpandableRow, VerticalLineContainer, getToolIcon } from "./shared"
import { useMemo } from "react"
import { stripWorkspacePath } from "../../lib/pathUtils"
import { AnimatedShinyText } from "../ui/animated-shiny-text"
import { formatBashCommandTitle, toTitleCase } from "../../lib/formatters"
import { FileContentView } from "./FileContentView"
import type { SubagentTaskInput } from "../../../shared/types"

interface Props {
  message: ProcessedToolCall
  isLoading?: boolean
  localPath?: string | null
}

type ReadImageBlock = {
  type: "image"
  data: string
  mimeType?: string
}

const SUBAGENT_ACTION_TITLES: Record<string, string> = {
  spawnAgent: "Start subagent",
  sendInput: "Send input to subagent",
  resumeAgent: "Resume subagent",
  wait: "Wait for subagent",
  closeAgent: "Close subagent",
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function getReceiverLabel(input: SubagentTaskInput) {
  const count = input.receiverThreadIds?.length ?? 0
  if (count > 1) return `${count} subagents`
  return "subagent"
}

export function getSubagentActionTitle(input: SubagentTaskInput, toolName = "Task") {
  const action = input.subagentType
  if (action === "sendInput") return `Send input to ${getReceiverLabel(input)}`
  if (action === "resumeAgent") return `Resume ${getReceiverLabel(input)}`
  if (action === "wait") return `Wait for ${getReceiverLabel(input)}`
  if (action === "closeAgent") return `Close ${getReceiverLabel(input)}`
  if (action === "spawnAgent") return "Start subagent"
  if (action) return `Run ${toTitleCase(action)} subagent`
  return toolName
}

function getSubagentResultValue(result: unknown, key: string): unknown {
  return asRecord(result)?.[key]
}

function getSubagentDisplayInput(input: SubagentTaskInput, result: unknown): SubagentTaskInput {
  const resultRecord = asRecord(result)
  if (!resultRecord) return input

  return {
    ...input,
    status: typeof resultRecord.status === "string" ? resultRecord.status : input.status,
    prompt: typeof resultRecord.prompt === "string" || resultRecord.prompt === null ? resultRecord.prompt : input.prompt,
    agentsStates: (asRecord(resultRecord.agentsStates) as SubagentTaskInput["agentsStates"] | null) ?? input.agentsStates,
  }
}

export function SubagentTaskDetails({ input, result }: { input: SubagentTaskInput; result?: unknown }) {
  const displayInput = getSubagentDisplayInput(input, result)
  const receiverThreadIds = displayInput.receiverThreadIds ?? []
  const agentsStates = displayInput.agentsStates
    ?? (asRecord(getSubagentResultValue(result, "agentsStates")) as SubagentTaskInput["agentsStates"] | null)
  const prompt = displayInput.prompt

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="grid gap-1.5">
        <span className="font-medium text-muted-foreground">Action</span>
        <div className="flex flex-wrap gap-2 text-foreground/80">
          <span>{SUBAGENT_ACTION_TITLES[displayInput.subagentType ?? ""] ?? getSubagentActionTitle(displayInput)}</span>
          {displayInput.status && <span className="text-muted-foreground">status: {displayInput.status}</span>}
        </div>
      </div>
      {prompt && (
        <MetaCodeBlock label="Prompt" copyText={prompt}>
          {prompt}
        </MetaCodeBlock>
      )}
      {(displayInput.senderThreadId || receiverThreadIds.length > 0) && (
        <div className="grid gap-1.5">
          <span className="font-medium text-muted-foreground">Threads</span>
          <div className="grid gap-1 text-muted-foreground">
            {displayInput.senderThreadId && (
              <span>from {displayInput.senderThreadId}</span>
            )}
            {receiverThreadIds.length > 0 && (
              <span>to {receiverThreadIds.join(", ")}</span>
            )}
          </div>
        </div>
      )}
      {agentsStates && Object.keys(agentsStates).length > 0 && (
        <div className="grid gap-1.5">
          <span className="font-medium text-muted-foreground">Agents</span>
          <div className="grid gap-1">
            {Object.entries(agentsStates).map(([threadId, state]) => (
              <div key={threadId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5">
                <span className="truncate text-foreground/80">{threadId}</span>
                <span className="text-muted-foreground">{state.status}</span>
                {state.message && (
                  <span className="col-span-2 text-muted-foreground">{state.message}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function extractReadImageBlocks(value: unknown): ReadImageBlock[] {
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

  return blocks.flatMap((block) => {
    if (!block || typeof block !== "object" || !("type" in block) || block.type !== "image") {
      return []
    }

    if ("data" in block && typeof block.data === "string") {
      return [{
        type: "image",
        data: block.data,
        mimeType: typeof block.mimeType === "string" ? block.mimeType : undefined,
      } satisfies ReadImageBlock]
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
      return [{
        type: "image",
        data: block.source.data,
        mimeType: typeof block.source.media_type === "string" ? block.source.media_type : undefined,
      } satisfies ReadImageBlock]
    }

    return []
  })
}

export function ReadResultImages({ images }: { images: ReadonlyArray<ReadImageBlock> }) {
  return (
    <div className="flex flex-col gap-3">
      {images.map((image, index) => {
        const mimeType = image.mimeType || "image/png"
        return (
          <div key={`${mimeType}:${index}`} className="overflow-hidden rounded-lg border border-border bg-muted/20">
            <img
              src={`data:${mimeType};base64,${image.data}`}
              alt={`Read result ${index + 1}`}
              className="max-h-[50vh] w-full object-contain bg-background"
            />
          </div>
        )
      })}
    </div>
  )
}

export function ToolCallMessage({ message, isLoading = false, localPath }: Props) {
  const hasResult = message.result !== undefined
  const showLoadingState = !hasResult && isLoading

  const name = useMemo(() => {
    if (message.toolKind === "skill") {
      return message.input.skill
    }
    if (message.toolKind === "glob") {
      return `Search files ${message.input.pattern === "**/*" ? "in all directories" : `matching ${message.input.pattern}`}`
    }
    if (message.toolKind === "grep") {
      const pattern = message.input.pattern
      const outputMode = message.input.outputMode
      if (outputMode === "count") {
        return `Count \`${pattern}\` occurrences`
      }
      if (outputMode === "content") {
        return `Find \`${pattern}\` in text`
      }
      return `Find \`${pattern}\` in files`
    }
    if (message.toolKind === "bash") {
      return message.input.description || (message.input.command ? formatBashCommandTitle(message.input.command) : "Bash")
    }
    if (message.toolKind === "web_search") {
      return message.input.query || "Web Search"
    }
    if (message.toolKind === "read_file") {
      return `Read ${stripWorkspacePath(message.input.filePath, localPath)}`
    }
    if (message.toolKind === "write_file") {
      return `Write ${stripWorkspacePath(message.input.filePath, localPath)}`
    }
    if (message.toolKind === "edit_file") {
      return `Edit ${stripWorkspacePath(message.input.filePath, localPath)}`
    }
    if (message.toolKind === "delete_file") {
      return `Delete ${stripWorkspacePath(message.input.filePath, localPath)}`
    }
    if (message.toolKind === "mcp_generic") {
      return `${toTitleCase(message.input.tool)} from ${toTitleCase(message.input.server)}`
    }
    if (message.toolKind === "subagent_task") {
      return getSubagentActionTitle(message.input, message.toolName)
    }
    return message.toolName
  }, [message.input, message.toolName, localPath])

  const isAgent = useMemo(() => message.toolKind === "subagent_task", [message.toolKind])
  const description = useMemo(() => {
    if (message.toolKind === "skill") {
      return message.input.skill
    }
  }, [message.input, message.toolKind])

  const isBashTool = message.toolKind === "bash"
  const isWriteTool = message.toolKind === "write_file"
  const isEditTool = message.toolKind === "edit_file"
  const isDeleteTool = message.toolKind === "delete_file"
  const isReadTool = message.toolKind === "read_file"
  const isSubagentTool = message.toolKind === "subagent_task"

  const resultText = useMemo(() => {
    if (typeof message.result === "string") return message.result
    if (!message.result) return ""
    if (typeof message.result === "object" && message.result !== null && "content" in message.result) {
      const content = (message.result as { content?: unknown }).content
      if (typeof content === "string") return content
    }
    return JSON.stringify(message.result, null, 2)
  }, [message.result])

  const readImages = useMemo(() => {
    if (!isReadTool) {
      return [] as ReadImageBlock[]
    }

    if (message.result && typeof message.result === "object" && "blocks" in message.result) {
      const blocks = (message.result as { blocks?: unknown }).blocks
      if (Array.isArray(blocks)) {
        const hydratedBlocks = extractReadImageBlocks(blocks)
        if (hydratedBlocks.length > 0) {
          return hydratedBlocks
        }
      }
    }

    return extractReadImageBlocks(message.rawResult)
  }, [isReadTool, message.rawResult, message.result])

  const inputText = useMemo(() => {
    switch (message.toolKind) {
      case "bash":
        return message.input.command
      case "write_file":
      case "delete_file":
        return message.input.content
      default:
        return JSON.stringify(message.input, null, 2)
    }
  }, [message])

  return (
    <MetaRow className="w-full">
      <ExpandableRow
        expandedContent={
          <VerticalLineContainer className="my-4 text-sm">
            <div className="flex flex-col gap-2">
              {isEditTool ? (
                <FileContentView
                  content=""
                  isDiff
                  oldString={message.input.oldString}
                  newString={message.input.newString}
                />
              ) : isDeleteTool ? (
                <FileContentView
                  content={message.input.content}
                />
              ) : isSubagentTool ? (
                <SubagentTaskDetails input={message.input} result={message.result} />
              ) : !isReadTool && !isWriteTool && (
                <MetaCodeBlock label={
                  isBashTool ? (
                    <span className="flex items-center gap-2 w-full">
                      <span>Command</span>
                      {!!message.input.timeoutMs && (
                        <span className="text-muted-foreground">timeout: {String(message.input.timeoutMs)}ms</span>
                      )}
                      {!!message.input.runInBackground && (
                        <span className="text-muted-foreground">background</span>
                      )}
                    </span>
                  ) : isWriteTool ? "Contents" : "Input"
                } copyText={inputText}>
                  {inputText}
                </MetaCodeBlock>
              )}
              {hasResult && isReadTool && !message.isError && (
                readImages.length > 0 ? (
                  <div>
                    <span className="font-medium text-muted-foreground">Image</span>
                    <div className="mt-1">
                      <ReadResultImages images={readImages} />
                    </div>
                  </div>
                ) : (
                  <FileContentView
                    content={resultText}
                  />
                )
              )}
              {isWriteTool && !message.isError && (
                <FileContentView
                  content={message.input.content}
                />
              )}
              {hasResult && !isSubagentTool && !isReadTool && !(isWriteTool && !message.isError) && !(isEditTool && !message.isError) && !(isDeleteTool && !message.isError) && (
                <MetaCodeBlock label={message.isError ? "Error" : "Result"} copyText={resultText}>
                  {resultText}
                </MetaCodeBlock>
              )}
            </div>
          </VerticalLineContainer>
        }
      >

        <div className={`w-5 h-5 relative flex items-center justify-center`}>
          {(() => {
            if (message.isError) {
              return <X className="size-4 text-destructive" />
            }
            if (isAgent) {
              return <UserRound className="size-4 text-muted-icon" />
            }
            const Icon = getToolIcon(message.toolName)

            return <Icon className="size-4 text-muted-icon" />
          })()}
        </div>
        <MetaLabel className="text-left transition-opacity duration-200 truncate">
          <AnimatedShinyText
            animate={showLoadingState}
            shimmerWidth={Math.max(20, ((description || name)?.length ?? 33) * 3)}
          >
            {description || name}
          </AnimatedShinyText>
        </MetaLabel>



      </ExpandableRow>
    </MetaRow>
  )
}
