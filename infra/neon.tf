# Neon コミュニティ Provider（kislerdm/neon）。
# version は terraform.tf で固定済み。terraform init -upgrade は実行しないこと。

resource "neon_project" "main" {
  name       = "omome"
  region_id  = "aws-ap-northeast-1"
  pg_version = 16
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
