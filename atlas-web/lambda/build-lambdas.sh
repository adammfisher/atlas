#!/bin/bash
# Build script for Lambda functions with shared code

LAMBDA_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$LAMBDA_DIR/shared"
FUNCTIONS_DIR="$LAMBDA_DIR/functions"

echo "Building Lambda functions from $LAMBDA_DIR"

# Function to build a lambda zip
build_function() {
    local name=$1
    local source_dir="$FUNCTIONS_DIR/$name"
    local output_zip="$FUNCTIONS_DIR/${name}.zip"
    local temp_dir=$(mktemp -d)

    echo "Building $name..."

    # Copy function code
    cp "$source_dir/index.js" "$temp_dir/"

    # Copy shared directory
    cp -r "$SHARED_DIR" "$temp_dir/"

    # Create zip
    cd "$temp_dir"
    zip -r "$output_zip" . > /dev/null

    # Cleanup
    rm -rf "$temp_dir"

    echo "  Created $output_zip"
}

# Build each function
build_function "sessions"
build_function "projects"
build_function "files"
build_function "artifacts"
build_function "mcp-config"
build_function "auth"
build_function "memory-processor"

# Build chat (also needs shared)
echo "Building chat..."
CHAT_DIR="$FUNCTIONS_DIR/chat"
CHAT_ZIP="$LAMBDA_DIR/chat.zip"
TEMP_DIR=$(mktemp -d)

cp "$CHAT_DIR/index.js" "$TEMP_DIR/"
cp -r "$SHARED_DIR" "$TEMP_DIR/"

cd "$TEMP_DIR"
zip -r "$CHAT_ZIP" . > /dev/null
rm -rf "$TEMP_DIR"
echo "  Created $CHAT_ZIP"

# Build Lambda layer
echo "Building Lambda layer..."
LAYER_DIR="$LAMBDA_DIR/layers/common"
LAYER_ZIP="$LAMBDA_DIR/layers/common.zip"
TEMP_DIR=$(mktemp -d)

mkdir -p "$TEMP_DIR/nodejs"
cp "$LAYER_DIR/package.json" "$TEMP_DIR/nodejs/"
cd "$TEMP_DIR/nodejs"
npm install --production > /dev/null 2>&1

# Copy shared modules to layer (accessible as /opt/nodejs/shared/*)
mkdir -p "$TEMP_DIR/nodejs/shared"
cp "$SHARED_DIR"/*.js "$TEMP_DIR/nodejs/shared/" 2>/dev/null || true

cd "$TEMP_DIR"
zip -r "$LAYER_ZIP" . > /dev/null
rm -rf "$TEMP_DIR"
echo "  Created $LAYER_ZIP"

echo ""
echo "All Lambda functions built successfully!"
ls -la "$FUNCTIONS_DIR"/*.zip "$LAMBDA_DIR/chat.zip" "$LAYER_ZIP"
