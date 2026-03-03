---
description: "Create or update documentation pages in the Etendo wiki (docs.etendo.software). Use this skill when the user wants to write, edit, or add documentation for a feature, module, tool, bundle, how-to guide, or release notes in the Etendo wiki. Also trigger when the user mentions documenting something, writing docs, or updating the wiki."
argument-hint: "[create | update | release-notes]"
---

# /etendo:wiki — Create or update Etendo wiki documentation

**Arguments:** `$ARGUMENTS` (optional: `create` for new page, `update` for existing page, `release-notes` for changelog entries)

---

## Wiki Location

The wiki lives at:
```
{project_root}/modules/com.etendoerp.copilot/wiki-etendo_clean/
```

If this directory does not exist, ask the user for the correct wiki path.

**Site:** https://docs.etendo.software
**Engine:** MkDocs with Material for MkDocs theme
**Config:** `mkdocs.yml` at the wiki root

---

## Setup (first time)

If the user needs to set up the wiki locally:

```bash
# 1. Clone the docs repository
git clone git@github.com:etendosoftware/docs.git

# 2. Set up Python virtualenv (requires Python ^3.11)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Initialize GitFlow (only once after cloning)
git flow init

# 4. Create a feature branch for the documentation task
git flow feature start <jira-task-key>

# 5. Serve locally to preview
source venv/bin/activate
mkdocs serve
```

**PR workflow:** Open a PR targeting `develop`. After all comments are resolved and 2 approvals are obtained, merge. The site auto-deploys to https://docs.etendo.software.

---

## Step 1: Determine the documentation type

Ask the user what they want to document, then classify it:

| Type | Where it goes | Template |
|---|---|---|
| **Developer How-To Guide** | `docs/developer-guide/etendo-classic/how-to-guides/` | How-To template |
| **Developer Concept** | `docs/developer-guide/etendo-classic/concepts/` | Concept template |
| **Copilot Tool** | `docs/developer-guide/etendo-copilot/available-tools/` | Tool template |
| **Copilot How-To** | `docs/developer-guide/etendo-copilot/how-to-guides/` | How-To template |
| **RX Guide** | `docs/developer-guide/etendo-rx/how-to-guides/` | How-To template |
| **User Guide (feature/window)** | `docs/user-guide/etendo-classic/basic-features/{area}/` | User Guide template |
| **Bundle/Module (user)** | `docs/user-guide/etendo-classic/optional-features/bundles/{bundle}/` | Bundle template |
| **Bundle/Module (dev)** | `docs/developer-guide/etendo-classic/bundles/` | Bundle template |
| **Release Notes** | `docs/whats-new/release-notes/{product}/` | Release Notes template |
| **Getting Started** | `docs/getting-started/` | Getting Started template |

---

## Step 2: File naming and placement

### Naming conventions
- **Kebab-case** for all file and folder names: `how-to-create-a-background-process.md`
- **Descriptive names** that reflect the content: `docker-tool.md`, `intercompany.md`
- How-to guides always start with `how-to-`: `how-to-configure-mcp-servers-on-agents.md`

### Asset placement
Images go in the mirrored path under `docs/assets/`:
```
Page:   docs/developer-guide/etendo-copilot/available-tools/my-tool.md
Images: docs/assets/developer-guide/etendo-copilot/available-tools/my-tool/
```

Create the asset directory when the page is created:
```bash
mkdir -p docs/assets/{matching-path}/{page-name-without-extension}/
```

---

## Step 3: Write the page content

### Frontmatter (YAML — mandatory)

Every page MUST start with YAML frontmatter:

```yaml
---
tags:
  - Tag1
  - Tag2
  - Tag3
---
```

**Common tags by area:**
- Developer guides: `Etendo Classic`, `How to`, `Application Dictionary`, `Modules`, `Customization`
- Copilot tools: `Copilot`, tool-specific tags (`Docker`, `Python`, `Memory`, etc.)
- User guides: `Etendo Classic`, feature area (`Financial Management`, `Sales`, etc.)
- RX: `Etendo RX`, `API`, `Headless`
- Mobile: `Etendo Mobile`
- Release notes: product name, `Release Notes`

**Optional frontmatter fields:**
- `title:` — Override the page title (if omitted, first `#` heading is used)
- `description:` — SEO description
- `status: beta` — Marks the page as beta (shows a badge)

### Markdown conventions

#### Headings
```markdown
# Page Title (H1 — only ONE per page)

## Major Section (H2)

### Subsection (H3)

#### Detail (H4 — use sparingly)
```

#### Admonitions (info boxes)

Available types: `note`, `info`, `tip`, `success`, `warning`, `failure`, `error`, `example`

```markdown
!!!note
    A note about something.

!!!info
    Important information here.

!!!success
    A success result or confirmation.

!!!warning
    A warning about potential issues.

!!!failure
    An error or failure case.
```

Custom title (override the default heading):
```markdown
!!!failure "Custom title here"
    Body text.
```

For more: [MkDocs Admonitions reference](https://squidfunk.github.io/mkdocs-material/reference/admonitions/){target="_blank"}

#### Code blocks
Always specify the language. Use optional titles for clarity:
```markdown
 ```sql title="Create salary table"
 CREATE TABLE ht_salary (...);
 ```

 ```java title="EventHandler.java"
 public class MyHandler extends EntityPersistenceEventObserver { }
 ```

 ```bash
 ./gradlew smartbuild
 ```

 ```json title="Example input"
 {"key": "value"}
 ```
```

#### Content tabs

Use when documenting functionality with multiple options (JAR vs Source, Windows vs Linux, etc.). Readers choose the relevant tab:

```markdown
=== "JAR Mode"

    ```bash
    ./gradlew install
    ```

=== "Source Mode"

    ```bash
    ./gradlew expandCore
    ./gradlew install
    ```
```

#### Directory tree

Use for showing file/folder structures:

```markdown
 ``` title="Module structure"
 modules
 └── org.example.module
     └── referencedata
         └── standard
             ├── File1.xml
             └── File2.xml
 ```
```

#### Text formatting

| Element | When to use | Syntax |
|---|---|---|
| **Bold** | Use sparingly — emphasis on option names, UI labels | `**text**` |
| *Italic* | Quoting text from another source, foreign phrases, sample input text | `*text*` |
| `Backtick` | File paths, inline code, menu navigation | `` `text` `` |

**Bold** example: From the **Sales Order** window, click **New**.

**Italic** example: Enter *your username* in the field.

**Backtick** examples:
- Path: `/directory/filename.txt`
- Inline code: `./gradlew update.database`
- Menu navigation: `Document` > `New` > `Template`

#### Tables
```markdown
| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
| Value 1 | Value 2 | Value 3 |
```

#### Links

**Internal links** — always use relative paths with `.md` extension:
```markdown
[Link text](../../path/to/file.md)
[Link text with anchor](../path/to/file.md#section-anchor)
```

**External links** — always add `{target="_blank"}`:
```markdown
[External site](https://example.com){target="_blank"}
```

**Marketplace links** — standard format:
```markdown
[Module Name](https://marketplace.etendo.cloud/?#/product-details?module=MODULE_ID){target="\_blank"}
```

#### Material icons
```markdown
:material-menu: `Application` > `Menu Path` > `Item`
:material-file-document-outline: Document reference
:octicons-package-16: Javapackage: `com.example.module`
```

#### Buttons (link-styled)
```markdown
[:material-file-document-outline: Related Guide](#anchor){ .md-button .md-button--primary }
```

#### Lists

Use proper tab indentation — it is essential for list continuity:

```markdown
1. Numbered option 1
    - sub-item a
    - sub-item b
2. Numbered option 2
```

Bullet lists:
```markdown
- Item a
- Item b
```

Alphabetical order: always sort list items alphabetically unless a logical sequence exists.

#### Images

```markdown
![Description](../../../assets/developer-guide/area/subarea/image-name.png)
```

Asset folder must mirror the page path:
```
Page:   docs/developer-guide/how-to-guides/new-page.md
Images: docs/assets/developer-guide/how-to-guides/new-page/
```

### Menu navigation paths
When documenting UI windows, always show the menu path:
```markdown
:material-menu: `Application` > `General Setup` > `Security` > `User`
```

---

## Step 4: Apply the correct template

### Template: Copilot Tool

```markdown
---
tags:
    - Copilot
    - {ToolCategory}
    - {AdditionalTag}
---

# {Tool Name}

:octicons-package-16: Javapackage: `{javapackage}`

## Overview

{Brief description of what the tool does and its purpose.}

!!!info
    To include this functionality, the {Bundle Name} must be installed. For instructions, visit the marketplace: [{Bundle Name}](https://marketplace.etendo.cloud/?#/product-details?module={MODULE_ID}){target="\_blank"}. For details about versions, core compatibility, and new features, check [{Bundle} - Release notes](../../../whats-new/release-notes/{product}/bundles/release-notes.md).

## Functionality

{Detailed description of what the tool does.}

### Parameters

- **{Param1}**: {Description}
- **{Param2}**: {Description}
- **{Param3}**: (Optional) {Description}

### Execution Workflow

1. **{Step 1 title}**:
    - {Detail}

2. **{Step 2 title}**:
    - {Detail}

## Usage example

- **Example Input**

` ` `json
{JSON input example}
` ` `

- **Example Output**

` ` `json
{JSON output example}
` ` `

---
This work is licensed under :material-creative-commons: :fontawesome-brands-creative-commons-by: :fontawesome-brands-creative-commons-sa: [ CC BY-SA 2.5 ES](https://creativecommons.org/licenses/by-sa/2.5/es/){target="_blank"} by [Futit Services S.L](https://etendo.software){target="_blank"}.
```

### Template: Developer How-To Guide

```markdown
---
tags:
  - How to
  - Etendo Classic
  - {Topic}
  - {AdditionalTag}
---

# How to {Action}

## Overview

{Brief description of what this guide covers and when you would need it.}

## Objective

{Concrete scenario/use case that motivates this guide.}

## Prerequisites

- {Prerequisite 1}
- {Prerequisite 2}

## Modularity

All new developments must belong to a module that is not the _core_ module. Follow the [How to Create a Module](How_To_Create_a_Module.md) section to create one.

## Steps

### 1. {First major step}

{Detailed explanation with code samples and screenshots.}

### 2. {Second major step}

{Detailed explanation.}

### 3. {Third major step}

{Detailed explanation.}

## Result

{What the user should see/have after completing all steps.}

---
This work is a derivative of [{Original Title}]({original_url}){target="_blank"} by [{Original Author}]({author_url}){target="_blank"}, used under [CC BY-SA 2.5 ES](https://creativecommons.org/licenses/by-sa/2.5/es/){target="_blank"}. This work is licensed under [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5/){target="_blank"} by [Etendo](https://etendo.software){target="_blank"}.
```

### Template: User Guide (Window/Feature)

```markdown
---
tags:
  - Etendo Classic
  - {Feature Area}
  - {AdditionalTag}
---

# {Window/Feature Name}

:material-menu: `Application` > `{Menu Path}` > `{Window Name}`

## Overview

{Brief description of the window/feature purpose.}

## {Tab/Section Name}

{Description of this tab or section.}

### Fields

| Field | Description |
| --- | --- |
| **{Field 1}** | {Description} |
| **{Field 2}** | {Description} |

![{Tab name}](../../assets/{matching-path}/{image-name}.png)

## {Another Tab/Section}

{Content for other tabs.}

---
This work is a derivative of [{Original Title}]({original_url}){target="_blank"} by [{Original Author}]({author_url}){target="_blank"}, used under [CC BY-SA 2.5 ES](https://creativecommons.org/licenses/by-sa/2.5/es/){target="_blank"}. This work is licensed under [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5/){target="_blank"} by [Etendo](https://etendo.software){target="_blank"}.
```

### Template: Bundle Overview

```markdown
---
tags:
  - {Bundle Name}
  - Bundle
  - {Product}
---

# {Bundle Name}

## Overview

{Description of what the bundle provides and its value.}

!!!info
    To install this bundle, visit the marketplace: [{Bundle Name}](https://marketplace.etendo.cloud/?#/product-details?module={MODULE_ID}){target="\_blank"}.

## Modules Included

| Module | Description |
| --- | --- |
| [{Module 1}](./module-1.md) | {Brief description} |
| [{Module 2}](./module-2.md) | {Brief description} |

## Installation

{Installation steps or link to standard install guide.}

---
This work is licensed under :material-creative-commons: :fontawesome-brands-creative-commons-by: :fontawesome-brands-creative-commons-sa: [ CC BY-SA 2.5 ES](https://creativecommons.org/licenses/by-sa/2.5/es/){target="_blank"} by [Futit Services S.L](https://etendo.software){target="_blank"}.
```

### Template: Release Notes

```markdown
---
tags:
  - Release Notes
  - {Product}
---

# {Product/Bundle} Release Notes

## {Version or Date}

### New Features

- **{Feature name}:** {Brief description}.

### Bug Fixes

- **{Fix description}:** {Details}. [{JIRA-KEY}](https://github.com/etendosoftware/{repo}/issues/{N}){target="_blank"}

### Improvements

- **{Improvement}:** {Details}.

### Known Issues

- {Issue description}.
```

---

## Step 5: Register in mkdocs.yml navigation

After creating the page, it MUST be added to the `nav:` section of `mkdocs.yml` for it to appear in the site navigation.

1. Read `mkdocs.yml` and find the correct section in the `nav:` tree.
2. Add the new entry following the existing indentation and pattern.
3. Use the same title format as sibling entries.

Example:
```yaml
nav:
  - Developer Guide:
    - Etendo:
      - How to Guides:
        - How to Create a Background Process: developer-guide/etendo-classic/how-to-guides/how-to-create-a-background-process.md
        - My New Guide: developer-guide/etendo-classic/how-to-guides/my-new-guide.md  # <-- add here
```

!!!important
    - Always add pages in **alphabetical order** within their nav section.
    - The directory structure and the nav structure must match exactly.

---

## Step 6: Confirm and create

Before writing the file, show the user:

```
Wiki page:   docs/{full/path/to/page.md}
Title:       {Page title}
Type:        {Developer How-To | Tool | User Guide | etc.}
Tags:        {tag1, tag2, tag3}
Nav section: {where in mkdocs.yml}
```

Then:
1. Create the markdown file with the appropriate template filled in.
2. Create the asset directory (if images are expected).
3. Add the entry to `mkdocs.yml` nav.
4. Inform the user.

---

## Step 7: Output summary

```
+ Created wiki page: {page title}

  File:    docs/{path/to/page.md}
  Assets:  docs/assets/{path}/
  Nav:     Added to mkdocs.yml under {section}

  Preview locally:
    source venv/bin/activate && mkdocs serve

  Next steps:
    - Add screenshots to docs/assets/{path}/
    - Review content and formatting
    - Commit to feature branch (git flow feature start <jira-key>)
    - Open PR to `develop` — requires 2 approvals
    - Merge → auto-deploys to https://docs.etendo.software
```

---

## Writing rules

Apply these rules to all content written for the wiki:

### Keep it simple
Use short sentences and one idea per sentence.

- **Wrong:** *The manufacturing module allows users to define process plans, work requirements, and work efforts; this is how the processes that produce intermediate and final goods work.*
- **Correct:** *The manufacturing module allows users to define process plans, work requirements, and work efforts. This section describes how processes produce intermediate and final goods.*

### Use present tense
Always write in the present tense. Avoid past and future tenses. Do not use *must*, *have to*, *need to*, *will*, *should*.

- **Wrong:** *You will need to press Enter to restart the system.*
- **Correct:** *Press Enter to restart the system.*

### Use imperative (third person)
Address the reader in the imperative form:

- **Wrong:** *You should run the install script.*
- **Correct:** *Run the install script.*

Addressing the reader as *you* is acceptable when it makes the documentation easier to follow.

### No contractions
Do not use contractions: write *do not* instead of *don't*, *you are* instead of *you're*, etc.

### Avoid gender-specific language
Use gender-neutral language. Use *they*/*their* as a singular generic pronoun when gender is unknown.

- **Wrong:** *Each user has his home directory.*
- **Correct:** *Each user has their home directory.*

### Describe only current functionality
Do not mention future plans or upcoming features.

- **Wrong:** *Charts can be saved as GIF. Support for new formats will be added in future versions.*
- **Correct:** *Charts can be saved as GIF.*

### Write for a global audience
- Avoid culture-specific names, addresses, or example data not common in English.
- Do not assume a specific currency or date format.
- Use globally neutral examples.

---

## Conventions checklist

Before finishing, verify:

**Structure**
- [ ] File name is kebab-case and lowercase
- [ ] Frontmatter has `tags:` (all tags in English)
- [ ] Only ONE `#` (H1) heading per page
- [ ] Page is registered in `mkdocs.yml` nav in **alphabetical order**
- [ ] Directory structure matches nav structure in `mkdocs.yml`
- [ ] License footer is present at the bottom of the page

**Links and assets**
- [ ] All external links have `{target="_blank"}`
- [ ] All internal links use relative paths with `.md` extension
- [ ] Images reference the correct relative path under `docs/assets/`
- [ ] Asset directory exists and mirrors the page path

**Code and formatting**
- [ ] Code blocks specify the language (`sql`, `java`, `bash`, `json`, etc.)
- [ ] Bold used sparingly (option names, UI labels only)
- [ ] Menu paths use backticks with `>` separator
- [ ] Content tabs used when documenting multi-option procedures

**Writing**
- [ ] All content is in **English** (even if user communicates in another language)
- [ ] Present tense used throughout — no *will*, *should*, *must*
- [ ] Imperative form for instructions
- [ ] No contractions (*don't* → *do not*)
- [ ] No gender-specific pronouns — use *they*/*their*
- [ ] No mention of future functionality
- [ ] Short sentences — one idea per sentence

---

## Notes

- The wiki uses **Material for MkDocs** — admonitions (`!!!info`), code annotations, tabs, and icons are supported.
- Pages with `status: beta` in frontmatter show a beta badge.
- Files prefixed with `.` (dot) are excluded from the build (`exclude_docs: .*` in mkdocs.yml).
- When updating an existing page, read it first and preserve the existing structure, frontmatter, and license footer.
- Do NOT create empty pages or placeholder content — every page should have meaningful content.
- The wiki has Algolia search integration — good tags and clear headings improve discoverability.
