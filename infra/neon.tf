# Neon コミュニティ Provider（kislerdm/neon）。
# version は terraform.tf で固定済み。terraform init -upgrade は実行しないこと。

resource "neon_project" "main" {
  name                      = "omome"
  org_id                    = "org-blue-meadow-49976132"
  region_id                 = "aws-ap-southeast-1"
  pg_version                = 16
  history_retention_seconds = 21600
}

resource "neon_role" "omome" {
  project_id = neon_project.main.id
  branch_id  = neon_project.main.default_branch_id
  name       = "omome"
}

resource "neon_database" "omome" {
  project_id = neon_project.main.id
  branch_id  = neon_project.main.default_branch_id
  name       = "omome"
  owner_name = neon_role.omome.name
}
