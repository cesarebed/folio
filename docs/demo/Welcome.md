---
author: Folio
tags: [markdown, notes, demo]
updated: 2026-10-29
---

# Welcome to Folio

Folio reads and writes the **Markdown** files already on your Mac, without importing them into a database. Open any folder, browse it from the sidebar and keep several documents open in *tabs*.

> [!tip] Handy shortcuts
> Press ⌘P to find a file anywhere on your Mac, ⌘E to switch between reading and editing, and ⌘⇧F to search inside files.

## What it can show

- Links between notes, like [[Roadmap]] or [a relative path](Journal/2026-10-29.md)
- Task lists you can tick with a click
- Highlighted code, tables, math and diagrams

### This week

- [x] Tidy up the project notes
- [x] Draft the presentation
- [ ] Review the roadmap with the team

## Code

```python
def word_count(text: str) -> int:
    """Count the words in a document."""
    return len(text.split())

print(word_count("Folio reads and writes Markdown"))  # 5
```

## Table

| Format         | Read | Edit |
|----------------|:----:|:----:|
| `.md`          | yes  | yes  |
| `.markdown`    | yes  | yes  |
| `.textbundle`  | yes  | yes  |

## Math

The variance of a sample is $s^2 = \frac{1}{n-1}\sum_{i=1}^{n}(x_i - \bar{x})^2$.

## Diagrams

```mermaid
graph LR
  A[Open folder] --> B[Read]
  B --> C[Edit]
  C --> D[Autosave]
```

Footnotes work the way you'd expect[^1].

[^1]: The YAML front matter at the top of the file is shown as a properties table, too.
