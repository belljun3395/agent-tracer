# 5개 이미지 타깃을 하나의 그래프로 빌드하며 공유 스테이지는 한 번만 돈다.
# CI가 이 파일로 bake하고 로컬은 docker compose가 같은 Dockerfile 타깃을 그대로 쓴다.

# 타깃마다 독립된 gha 스코프를 준다. 한 스코프에 여러 타깃이 동시에 mode=max로 쓰면 매니페스트가 서로 덮어써 레이스가 난다.
function "cache" {
  params = [scope]
  result = {
    cache-from = ["type=gha,scope=${scope}"]
    cache-to   = ["type=gha,scope=${scope},mode=max"]
  }
}

group "default" {
  targets = ["runtime-api", "tracer-api", "projector", "ai-agent-worker", "web"]
}

target "runtime-api" {
  context    = "."
  dockerfile = "Dockerfile"
  target     = "runtime-api"
  tags       = ["agent-tracer-runtime-api:ci"]
  cache-from = cache("runtime-api").cache-from
  cache-to   = cache("runtime-api").cache-to
}

target "tracer-api" {
  context    = "."
  dockerfile = "Dockerfile"
  target     = "tracer-api"
  tags       = ["agent-tracer-tracer-api:ci"]
  cache-from = cache("tracer-api").cache-from
  cache-to   = cache("tracer-api").cache-to
}

target "projector" {
  context    = "."
  dockerfile = "Dockerfile"
  target     = "projector"
  tags       = ["agent-tracer-projector:ci"]
  cache-from = cache("projector").cache-from
  cache-to   = cache("projector").cache-to
}

target "ai-agent-worker" {
  context    = "."
  dockerfile = "Dockerfile"
  target     = "ai-agent-worker"
  tags       = ["agent-tracer-ai-agent-worker:ci"]
  cache-from = cache("ai-agent-worker").cache-from
  cache-to   = cache("ai-agent-worker").cache-to
}

target "web" {
  context    = "."
  dockerfile = "Dockerfile"
  target     = "web"
  tags       = ["agent-tracer-web:ci"]
  cache-from = cache("web").cache-from
  cache-to   = cache("web").cache-to
}
