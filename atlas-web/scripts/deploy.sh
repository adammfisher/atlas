#!/bin/bash
set -e

echo "🚀 Atlas Platform Deployment Script"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LAMBDA_DIR="$PROJECT_DIR/lambda"
TERRAFORM_DIR="$PROJECT_DIR/terraform"

echo -e "${YELLOW}Building Lambda layer...${NC}"
cd "$LAMBDA_DIR/layers/common"
npm install --production
mkdir -p nodejs
cp -r node_modules nodejs/
zip -r "$TERRAFORM_DIR/../lambda/layers/common.zip" nodejs
rm -rf nodejs
echo -e "${GREEN}✓ Layer built${NC}"

echo -e "${YELLOW}Packaging Lambda functions...${NC}"
FUNCTIONS=("chat" "sessions" "projects" "files" "mcp-config" "artifacts")

for func in "${FUNCTIONS[@]}"; do
    echo "  Packaging $func..."
    cd "$LAMBDA_DIR/functions/$func"
    
    # Copy shared modules
    mkdir -p shared
    cp "$LAMBDA_DIR/shared/"*.js shared/
    
    # Create zip
    zip -r "$TERRAFORM_DIR/../lambda/functions/$func.zip" index.js shared/
    
    # Cleanup
    rm -rf shared
done
echo -e "${GREEN}✓ All functions packaged${NC}"

echo -e "${YELLOW}Initializing Terraform...${NC}"
cd "$TERRAFORM_DIR"
terraform init
echo -e "${GREEN}✓ Terraform initialized${NC}"

echo ""
echo -e "${GREEN}Ready to deploy!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review terraform/variables.tf and adjust as needed"
echo "  2. Run: cd terraform && terraform plan"
echo "  3. Run: cd terraform && terraform apply"
echo ""
echo "After deployment:"
echo "  - API endpoint will be output by Terraform"
echo "  - Update frontend/.env with the API URL"
echo "  - Run: cd frontend && npm install && npm run dev"
