import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { getSubagentActionTitle, ReadResultImages, SubagentTaskDetails } from "./ToolCallMessage"

describe("ToolCallMessage", () => {
  test("renders read result image blocks as inline images", () => {
    const html = renderToStaticMarkup(
      <ReadResultImages
        images={[
          {
            type: "image",
            data: "ZmFrZS1pbWFnZS1kYXRh",
            mimeType: "image/png",
          },
        ]}
      />
    )

    expect(html).toContain("data:image/png;base64,ZmFrZS1pbWFnZS1kYXRh")
    expect(html).toContain("alt=\"Read result 1\"")
  })

  test("labels subagent actions with receiver context", () => {
    expect(getSubagentActionTitle({
      subagentType: "sendInput",
      receiverThreadIds: ["thread-2", "thread-3"],
    })).toBe("Send input to 2 subagents")
  })

  test("renders readable subagent task details", () => {
    const html = renderToStaticMarkup(
      <SubagentTaskDetails
        input={{
          subagentType: "spawnAgent",
          status: "inProgress",
          senderThreadId: "thread-1",
          receiverThreadIds: ["thread-2"],
          prompt: "Inspect tests",
          agentsStates: {
            "thread-2": { status: "running", message: "Inspecting" },
          },
        }}
        result={{ status: "completed" }}
      />
    )

    expect(html).toContain("Start subagent")
    expect(html).toContain("status: completed")
    expect(html).toContain("Inspect tests")
    expect(html).toContain("from thread-1")
    expect(html).toContain("to thread-2")
    expect(html).toContain("Inspecting")
  })
})
