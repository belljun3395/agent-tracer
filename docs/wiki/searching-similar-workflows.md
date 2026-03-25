# Searching Similar Workflows

유사 workflow 검색은 과거 성공 사례를 재사용하기 위한 기능이다.

## 입력

- 짧은 핵심 query
- optional limit

## 현재 특징

- SQLite LIKE 기반 탐색
- workflow context markdown을 생성해 결과에 포함

## 운영 메모

- 긴 자연어 문장보다 짧은 핵심 키워드가 더 잘 맞는다
- 결과 품질과 비용 사이 균형을 위해 검색용 read model을 장기적으로 검토할 수 있다
