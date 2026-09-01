# Structurizr DSL — Language Reference

Self-contained syntax reference for authoring `structurizr.dsl` files.

Notation:
- `<...>` = required property
- `[...]` = optional property
- Most statements follow: `keyword <required> [optional]`

A workspace is the top-level construct. It wraps a single `model` (elements and
relationships) and an optional `views` block. Identifiers assigned with `=` can be
referenced later (e.g. `u = person "User"` then `u -> sys "Uses"`).

---

## Model elements

### workspace
Top-level construct; wrapper for `model` and `views`. Optional name and description.

```
workspace [name] [description] {
    ...
}
```

Extend another workspace (local file or HTTPS URL to a DSL/JSON file). All
identifiers from the base DSL workspace are available in the extension.

```
workspace extends <file|url> {
    ...
}
```

Permitted children: `name`, `description`, `properties`, `!identifiers`, `!docs`,
`!adrs`, `model`, `views`, `configuration`.

Special workspace `properties`:
- `structurizr.dsl` — base64 of the DSL source (auto-created; only stored when DSL is "portable").
- `structurizr.dsl.source` — `true` (default) to retain DSL source, `false` to discard.

Constructs that make DSL non-portable: `extends <file>`, `!impliedRelationships <fqcn>`,
`!include <file|directory>`, `!script <file>`, `!plugin`, `!docs`, `!adrs`/`!decisions`,
`!components`, `icon <file>`, `theme <file>`, `logo <file>`.

### model
Required block where elements and relationships are defined.

```
model {
    ...
}
```

Permitted children: `!identifiers`, `archetypes`, `group`, `person`, `softwareSystem`,
`deploymentEnvironment`, `element`, `->` (relationship).

### archetypes
User-defined types that extend basic element/relationship types and add defaults for
description, technology, tags, properties, and perspectives.

### group
Named grouping of elements, rendered as a boundary. Groups can be nested.

```
group <name> {
    ...
}
```

Groups may only contain elements of the same abstraction level:

| Location | Permitted elements |
| --- | --- |
| Model | People and software systems |
| Software System | Containers |
| Container | Components |

`group` can also set a component's group name:

```
component "Component Name" {
    group "Group Name"
}
```

### person
A user, actor, role, or persona. Default tags: `Element`, `Person`.

```
person <name> [description] [tags] {
    ...
}
```

Permitted children: `description`, `tags`, `url`, `properties`, `perspectives`, `->`.

### softwareSystem
Defines a software system. Default tags: `Element`, `Software System`.

```
softwareSystem <name> [description] [tags] {
    ...
}
```

Permitted children: `!docs`, `!adrs`, `group`, `container`, `description`, `tags`,
`url`, `properties`, `perspectives`, `->`.

### container
A container within a software system. Default tags: `Element`, `Container`.

```
container <name> [description] [technology] [tags] {
    ...
}
```

Permitted children: `!docs`, `!adrs`, `group`, `component`, `!components`, `description`,
`technology`, `tags`, `url`, `properties`, `perspectives`, `->`.

### component
A component within a container. Default tags: `Element`, `Component`.

```
component <name> [description] [technology] [tags] {
    ...
}
```

Permitted children: `!docs`, `!adrs`, `description`, `technology`, `tags`, `url`,
`properties`, `perspectives`, `group`, `->`.

### element
Custom element outside the C4 model. Default tag: `Element`.

```
element <name> [metadata] [description] [tags] {
    ...
}
```

Permitted children: `description`, `tags`, `url`, `properties`, `perspectives`, `->`.

---

## Deployment elements

### deploymentEnvironment
A deployment environment (e.g. development, staging, live).

```
deploymentEnvironment <name> {
    ...
}
```

Permitted children: `group`, `deploymentGroup`, `deploymentNode`, `->`, `-/>` (remove relationship).

### deploymentGroup
Named deployment group. Restricts the scope in which relationships between
instances are automatically replicated.

```
deploymentGroup <name>
```

### deploymentNode
A deployment node. Default tags: `Element`, `Deployment Node`.

```
deploymentNode <name> [description] [technology] [tags] [instances] {
    ...
}
```

Permitted children: `group`, `deploymentNode` (nestable), `infrastructureNode`,
`softwareSystemInstance`, `containerInstance`, `instanceOf`, `->`, `description`,
`technology`, `instances`, `tags`, `url`, `properties`, `perspectives`.

### infrastructureNode
Load balancer, firewall, DNS, etc. Default tags: `Element`, `Infrastructure Node`.

```
infrastructureNode <name> [description] [technology] [tags] {
    ...
}
```

Permitted children: `->`, `description`, `technology`, `tags`, `url`, `properties`, `perspectives`.

### softwareSystemInstance
Instance of a software system deployed on the parent node. `identifier` must
reference a software system. `deploymentGroups` is a comma-separated list of group
identifiers. Adds tag: `Software System Instance`.

```
softwareSystemInstance <identifier> [deploymentGroups] [tags] {
    ...
}
```

Permitted children: `->`, `description`, `tags`, `url`, `properties`, `perspectives`, `healthCheck`.

### containerInstance
Instance of a container deployed on the parent node. `identifier` must reference a
container. Adds tag: `Container Instance`.

```
containerInstance <identifier> [deploymentGroups] [tags] {
    ...
}
```

Permitted children: `->`, `description`, `tags`, `url`, `properties`, `perspectives`, `healthCheck`.

### instanceOf
Alias for `softwareSystemInstance` and `containerInstance`.

```
instanceOf <identifier> [deploymentGroups] [tags] {
    ...
}
```

### healthCheck
HTTP health check for the parent instance. `interval` in seconds (default 60),
`timeout` in milliseconds (default 0).

```
healthCheck <name> <url> [interval] [timeout]
```

---

## Relationships

Uni-directional relationships between two elements:
- `->` basic relationship.
- `--https->` (etc.) relationship based on an archetype.

Explicit source:

```
<identifier> -> <identifier> [description] [technology] [tags] {
    ...
}
```

Example: `user -> softwareSystem "Uses"`

Source is the element in scope (optionally with the `this` keyword):

```
person user {
    -> softwareSystem "Uses"
    this -> softwareSystem "Uses"   // equivalent
}
```

Default tag: `Relationship`.

Permitted relationship source → destination types:

| Source | Destination |
| --- | --- |
| Person | Person, Software System, Container, Component |
| Software System | Person, Software System, Container, Component |
| Container | Person, Software System, Container, Component |
| Component | Person, Software System, Container, Component |
| Deployment Node | Deployment Node |
| Infrastructure Node | Deployment Node, Infrastructure Node, Software System Instance, Container Instance |
| Software System Instance | Infrastructure Node |
| Container Instance | Infrastructure Node |

Permitted children: `tags`, `url`, `properties`, `perspectives`.

Remove a relationship with the `-/>` operator.

---

## Element / relationship properties

### tag / tags
```
tag "Tag 1"
tags "Tag 1"
tags "Tag 1,Tag 2"
tags "Tag 1" "Tag 2"
```

### description
```
description "Description"
```

### technology
For container, component, deployment node, infrastructure node.
```
technology "Technology"
```

### instances
Number of instances of a deployment node — static number or range
(e.g. `0..1`, `1..3`, `5..10`, `0..N`, `1..N`).
```
instances "4"
instances "1..N"
```

### url
```
url https://example.com
```

### properties
One or more name/value pairs.
```
properties {
    <name> <value>
    ...
}
```

### perspectives
Named perspectives for an element or relationship.
```
perspectives {
    // syntax 1
    <name> <description> [value]

    // syntax 2
    perspective <name> {
        description <description>
        value <value>
        url <url>
    }
}
```

---

## Finding / bulk operations

### !element
Find a previously defined element to add tags, properties, children, etc.
```
!element <identifier> {
  ...
}
```
For JSON-based workspaces, find by canonical name:
```
<identifier> = !element <canonical name> {
  ...
}
```

### !elements
Find a set of elements via an element expression for bulk operations.
```
!elements <expression> {
    ...
}
```
Permitted children: `->`, `tag`, `tags`, `url`, `properties`, `perspectives`.

### !relationship
Find a previously defined relationship to add tags, properties, etc.
```
!relationship <identifier> {
  ...
}
```
For JSON-based workspaces:
```
<identifier> = !relationship <canonical name> {
  ...
}
```

### !relationships
Find a set of relationships via a relationship expression for bulk operations.
```
!relationships <expression> {
    ...
}
```
Permitted children: `tag`, `tags`, `url`, `properties`, `perspectives`.

> `!extend` and `!ref` are deprecated — use `!element` or `!relationship`.

---

## Views

```
views {
    ...
}
```

Can contain: `systemLandscape`, `systemContext`, `container`, `component`, `filtered`,
`dynamic`, `deployment`, `custom`, `image`, `styles`, `theme`, `themes`, `terminology`,
`properties`.

If no `views` block (or an empty one) is present, a default set of views with
auto-layout is generated. Defining any view removes the defaults; re-add them with:
```
!script groovy {
    workspace.views.createDefaultViews()
}
```

> Auto-generated view keys are not stable over time — specify a `[key]` explicitly to
> preserve manual layout information.

### systemLandscape view
```
systemLandscape [key] [description] {
    ...
}
```
Children: `include`, `exclude`, `autoLayout`, `default`, `animation`, `title`,
`description`, `properties`.

### systemContext view
```
systemContext <software system identifier> [key] [description] {
    ...
}
```
Children: `include`, `exclude`, `autoLayout`, `default`, `animation`, `title`,
`description`, `properties`.

### container view
```
container <software system identifier> [key] [description] {
    ...
}
```
Children: `include`, `exclude`, `autoLayout`, `default`, `animation`, `title`,
`description`, `properties`.

### component view
```
component <container identifier> [key] [description] {
    ...
}
```
Children: `include`, `exclude`, `autoLayout`, `default`, `animation`, `title`,
`description`, `properties`.

### filtered view
A filter on top of an existing view. `baseKey` is the key of a System Landscape,
System Context, Container, or Component view. Mode `include`/`exclude` determines
behaviour against the given `tags`.
```
filtered <baseKey> <include|exclude> <tags> [key] [description] {
    ...
}
```
Example: `filtered <baseKey> include "Element,Relationship" [key] [description]`

Once a filtered view is defined on a base view, that base view no longer appears in
the Structurizr diagram list (by design). To keep it, add a second filtered view
including the `Element` and `Relationship` tags.

Children: `default`, `title`, `description`, `properties`.

### dynamic view
```
dynamic <*|software system identifier|container identifier> [key] [description] {
    ...
}
```
Scope determines what can be added:
- `*` — people and software systems.
- Software system — people, other software systems, and containers.
- Container — people, other software systems, other containers, and components.

Defined by listing relationships (not includes):
```
<element identifier> -> <element identifier> [description] [technology]
<relationship identifier> [description]
```
Optional explicit ordering:
```
[order:] <element identifier> -> <element identifier> [description] [technology]
[order:] <relationship identifier> [description]
```
A dynamic view shows *instances* of relationships from the static model; the
description can be overridden per-interaction.

Children: `autoLayout`, `default`, `title`, `description`, `properties`.

### deployment view
```
deployment <*|software system identifier> <environment> [key] [description] {
    ...
}
```
`environment` is a deployment environment identifier or name. Scope:
- `*` — all deployment nodes, infrastructure nodes, and container instances in the environment.
- Software system — all deployment/infrastructure nodes in the environment, plus container instances belonging to that software system.

Children: `include`, `exclude`, `autoLayout`, `default`, `animation`, `title`,
`description`, `properties`.

### custom view
Only custom elements may be included.
```
custom [key] [title] [description] {
    ...
}
```
Children: `include`, `exclude`, `autoLayout`, `default`, `animation`, `title`,
`description`, `properties`.

### image view
```
image <*|element identifier> [key] {
    ...
}
```
Image source (one of):
- `plantuml <file|url|viewKey>`
- `mermaid <file|url|viewKey>`
- `kroki <format> <file|url>`
- `image <file|url>`

Service URLs/formats can be set as view-set properties:
```
views {
    properties {
        "plantuml.url" "http://localhost:7777"
        "plantuml.format" "svg"
        "mermaid.url" "http://localhost:8888"
        "mermaid.format" "svg"
        "kroki.url" "http://localhost:9999"
        "kroki.format" "svg"
    }
    ...
}
```
Children: `default`, `title`, `description`, `properties`.

---

## View contents

### include
```
include <*|identifier|expression> [*|identifier|expression...]
```
Including elements also includes the relationships between them. Wildcard `*`
behaviour by diagram type:
- System Landscape: all people and software systems.
- System Context: the scoped system plus directly connected people/systems.
- Container: all containers in the scoped system plus directly connected people/systems.
- Component: all components in the scoped container plus directly connected people, systems, and containers.
- Deployment: all deployment/infrastructure nodes and container instances in the environment (and optional system) scope.

Reluctant wildcard `*?` (system context, container, component views) adds only
relationships to/from the scoped element.

Relationships can be included individually or by expression (operate only on elements
already in the view):
```
include <identifier|expression> [identifier|expression...]
```

### exclude
Exclude elements or relationships:
```
exclude <identifier|expression> [identifier|expression...]
```
Relationship targeting (note the surrounding double quotes):
```
exclude "<*|identifier|expression> -> <*|identifier|expression>"
```
Combinations:
- `* -> *` — all relationships between all elements
- `source -> *` — all relationships from `source` to any element
- `* -> destination` — all relationships from any element to `destination`
- `source -> destination` — all relationships from `source` to `destination`

### autoLayout
```
autoLayout [tb|bt|lr|rl] [rankSeparation] [nodeSeparation]
```
Rank direction: `tb` top-to-bottom (default), `bt` bottom-to-top, `lr` left-to-right,
`rl` right-to-left. `rankSeparation` (default 300px), `nodeSeparation` (default 300px).

### default
Sets the default view to be shown.
```
default
```

### animation
Each line is one step listing the elements added in that step.
```
animation {
    <identifier> [identifier...]
    <identifier> [identifier...]
}
```

### title
```
title <title>
```

---

## Styles

```
styles {
    ...
}
```
Children: `light`, `dark`, `element`, `relationship`.

`light { ... }` and `dark { ... }` wrap styles for light/dark mode; each accepts
`element` and `relationship` children.

### element style
All nested properties are optional.
```
element <tag> {
    shape <Box|RoundedBox|Circle|Ellipse|Hexagon|Diamond|Cylinder|Bucket|Pipe|Person|Robot|Folder|WebBrowser|Window|Terminal|Shell|MobileDevicePortrait|MobileDeviceLandscape|Component>
    icon <file|url>
    width <integer>
    height <integer>
    background <#rrggbb|color name>
    color <#rrggbb|color name>
    colour <#rrggbb|color name>
    stroke <#rrggbb|color name>
    strokeWidth <integer: 1-10>
    fontSize <integer>
    border <solid|dashed|dotted>
    opacity <integer: 0-100>
    metadata <true|false>
    description <true|false>
    properties {
        name value
    }
}
```
Colors: hex (`#ffff00`) or CSS/HTML named color (`yellow`). Shapes and icons may not
be fully supported by PlantUML/Mermaid exports.

### relationship style
All nested properties are optional.
```
relationship <tag> {
    thickness <integer>
    color <#rrggbb|color name>
    colour <#rrggbb|color name>
    style <solid|dashed|dotted>
    routing <Direct|Orthogonal|Curved>
    jump <true|false>
    fontSize <integer>
    width <integer>
    position <integer: 0-100>
    opacity <integer: 0-100>
    properties {
        name value
    }
}
```

---

## Themes, terminology, configuration

### theme / themes
```
theme <name|url|file>
themes <name|url|file> [name|url|file] ... [name|url|file]
```
By name: must be installed. By URL: loaded dynamically. By file: inlined into the workspace.

### terminology
Override rendered terminology.
```
terminology {
    person <term>
    softwareSystem <term>
    container <term>
    component <term>
    deploymentNode <term>
    infrastructureNode <term>
    relationship <term>
    metadata <square|round|curly|angle|double-angle|none>
}
```

### configuration
```
configuration {
    ...
}
```
Children: `scope`, `visibility`, `users`, `properties`.

- `scope <landscape|softwaresystem|none>` — workspace scope.
- `visibility <private|public>` — workspace visibility.
- `users { <username> <read|write> }` — per-user access (roles: `read`, `write`).

---

## Directives

- `!include <file|directory|url>` — include DSL fragments from another source.
- `!identifiers <hierarchical|flat>` — set identifier scope.
- `!impliedRelationships <true|false|fqcn>` — configure implied relationship creation.
- `!docs <path> [fully qualified class name]` — attach Markdown/AsciiDoc docs to the parent (workspace, software system, or container).
- `!adrs <path> [type|fqn]` — attach Markdown/AsciiDoc ADRs to the parent.
- `!components` — DSL wrapper around the Structurizr for Java component finder (auto-discover Java components).
- `!script <groovy|kotlin|ruby|javascript>` or `!script <file>` — run inline or external JVM-language scripts.
- `!plugin <fqcn>` — run a Java plugin.
