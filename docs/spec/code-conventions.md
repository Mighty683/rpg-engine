# Code conventions

- Decompose code into small, reusable components and functions.
- Indentations are a sign of weakness, so keep your code flat and easy to read. Split code into reusable parts.
- Prefer SOLID and DRY designs where they improve clarity; do not introduce abstractions merely to satisfy a pattern.
- Use descriptive names for variables, functions, types, and classes. Names should state their purpose without forcing the reader to inspect the implementation.
- Document if needed public functions, types, classes, and non-obvious fields with their purpose, rationale, business context, and relevant design tradeoffs.
- Do not add line-by-line comments inside functions. The code itself must be clear enough to explain the mechanics.
- Start code files with a purpose and domain header when the language and repository conventions support it. Record consequential architectural decisions and relationships to other domain components which cannot be interpolated from code itself; do not add boilerplate headers where they would reduce clarity.
- We split code into business domain folders called modules placed in `src/modules`
- Reusable code elements of are exported to `src/shared` to be reused
