import { describe, expect, it } from "vitest";
import { createResponseError } from "~web/shared/api/client/response.js";

describe("createResponseError", () => {
  it("서버 오류 envelope의 상태와 코드를 보존한다", async () => {
    const error = await createResponseError(
      Response.json(
        {
          ok: false,
          error: {
            code: "not_found",
            message: "missing task",
            details: { taskId: "task-1" },
          },
        },
        { status: 404 },
      ),
      "/api/v1/tasks/task-1",
      "GET",
    );

    expect(error).toMatchObject({
      message: "missing task",
      status: 404,
      pathname: "/api/v1/tasks/task-1",
      code: "not_found",
      details: { taskId: "task-1" },
    });
  });
});
