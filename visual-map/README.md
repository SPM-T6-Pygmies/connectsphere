# Prerequisites

1. Git
2. Docker, Docker-compose, Docker Desktop
3. Colima (If you dislike Docker Desktop)

# Setting Up Structurizr Locally

Original documentation: https://docs.structurizr.com/local/quickstart

## 1. Pull the latest Docker Image

```bash
# working dir: visual_map/
docker pull structurizr/structurizr
```

## 2. Run the Docker Image

replacing `PATH` with the path to your Structurizr data directory:

```bash
docker run -it --rm -p 8080:8080 -e AUTO_REFRESH_INTERVAL=5000 -v PATH:/usr/local/structurizr structurizr/structurizr local
```
```bash
docker run -it --rm -p 8080:8080 -e AUTO_REFRESH_INTERVAL=5000 -v "$(pwd)":/usr/local/structurizr structurizr/structurizr local
```
For example, if your Structurizr data directory is located at /Users/simon/structurizr, the command would be:

```bash
docker run -it --rm -p 8080:8080 -e AUTO_REFRESH_INTERVAL=5000 -v ~/desktop/visual_map:/usr/local/structurizr structurizr/structurizr local
```

## 3. Open your Web Browser

With Structurizr running, you can head to http://localhost:8080 in your web browser, where you should see the workspace summary page.

# Additional Notes

## 1. Enabling Multi-Workspace mode

Create a `structurizr.properties` file in your data directory with this property:

```structurizr.properties
structurizr.workspaces=*
```

## 2. Create subdirectories for each workspace

Create a subdirectory for each workspace, where the subdirectory name represents the numeric ID of the workspace. Place your workspace.dsl file inside each subdirectory. Unlike single-workspace mode, Structurizr won't create these for you — you have to create them yourself.
Subdirectory names can optionally be suffixed with a descriptive label, as long as they match this pattern: `\d*-[a-zA-Z0-9_-]*`.

### Valid examples:

- 1
- 01
- 01-softwareSystemA
- 01-Software_System_A structurizr

Resulting structure:

```
my-data-dir/
├── structurizr.properties
├── 01-payment-service/
│   └── workspace.dsl
├── 02-user-auth/
│   └── workspace.dsl
└── 03-reporting/
    └── workspace.dsl
```

## 3. Accessing other workspaces locally

You will need to edit the url in your browser accordingly to view other workspaces. These work spaces can be referenced within the diagrams if you wish to split up the scope further

**Example:**

- Workspace 1 will be at http://localhost:8080/workspace/1
- Workspace 2 will be at http://localhost:8080/workspace/2
