import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { CommandErrorBanner } from "./ChatTranscriptViewport"

describe("CommandErrorBanner", () => {
  test("renders an inline retry action when provided", () => {
    const html = renderToStaticMarkup(
      <CommandErrorBanner message="Disconnected" onRetry={() => {}} />
    )

    expect(html).toContain("Disconnected")
    expect(html).toContain("Retry")
  })

  test("omits retry action when no retry handler is available", () => {
    const html = renderToStaticMarkup(
      <CommandErrorBanner message="Disconnected" />
    )

    expect(html).toContain("Disconnected")
    expect(html).not.toContain("Retry")
  })
})
