#!/bin/bash

# ========================================
# Configuration Variables - Edit These
# ========================================
APP_NAME="Claude Usage Dashboard"
DOCKER_USERNAME="0xparadin"
DOCKER_REPO="claude-usage-dashboard"
DOCKER_IMAGE_NAME="claude-usage-dashboard"

# ========================================
# Script Configuration - Do Not Edit Below
# ========================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
ENV_FILE="$SCRIPT_DIR/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
check_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        print_warning ".env file not found. Creating from .env.example..."
        if [ -f "$SCRIPT_DIR/.env.example" ]; then
            cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
            print_success ".env file created from .env.example"
        else
            print_error ".env.example file not found!"
            exit 1
        fi
    fi
}

# Check if docker and docker compose are installed
check_dependencies() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
}

# Check if uploads directory exists
check_uploads_dir() {
    UPLOADS_DIR="$SCRIPT_DIR/public/uploads"
    if [ ! -d "$UPLOADS_DIR" ]; then
        print_status "Creating uploads directory..."
        mkdir -p "$UPLOADS_DIR"
        print_success "Uploads directory created at $UPLOADS_DIR"
    fi
}

# Parse platform option
parse_platform() {
    local platform_arg="$1"
    case "$platform_arg" in
        linux/amd64|amd64)
            echo "linux/amd64"
            ;;
        linux/arm64|arm64)
            echo "linux/arm64"
            ;;
        linux/arm/v7|armv7)
            echo "linux/arm/v7"
            ;;
        darwin/amd64)
            echo "darwin/amd64"
            ;;
        darwin/arm64)
            echo "darwin/arm64"
            ;;
        multi|multiarch)
            echo "linux/amd64,linux/arm64"
            ;;
        ""|default)
            echo ""
            ;;
        *)
            print_error "Unsupported platform: $platform_arg"
            print_status "Supported platforms:"
            print_status "  linux/amd64 (or amd64)     - Linux x64"
            print_status "  linux/arm64 (or arm64)     - Linux ARM64"
            print_status "  linux/arm/v7 (or armv7)    - Linux ARMv7"
            print_status "  darwin/amd64                - macOS Intel"
            print_status "  darwin/arm64                - macOS Apple Silicon"
            print_status "  multi (or multiarch)        - Multi-platform (amd64,arm64)"
            exit 1
            ;;
    esac
}

# Show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  up, start         Start application stack"
    echo "  down, stop        Stop application stack"
    echo "  restart           Restart application stack"
    echo "  logs              Show logs from all services"
    echo "  status            Show status of services"
    echo "  build [platform]            Build application image"
    echo "  rebuild [platform]          Rebuild and restart services"
    echo "  push <image_tag> [platform] Build, tag and push to Docker Hub"
    echo "  pull <image_tag>            Pull and replace current image from Docker Hub"
    echo "  help                        Show this help message"
    echo ""
    echo "Platform Options:"
    echo "  amd64, linux/amd64          Linux x64 (default)"
    echo "  arm64, linux/arm64          Linux ARM64"
    echo "  armv7, linux/arm/v7         Linux ARMv7"
    echo "  darwin/amd64                macOS Intel"
    echo "  darwin/arm64                macOS Apple Silicon"
    echo "  multi, multiarch            Multi-platform build"
    echo ""
    echo "Examples:"
    echo "  $0 build amd64"
    echo "  $0 rebuild linux/arm64"
    echo "  $0 push ${DOCKER_USERNAME}/${DOCKER_REPO}:latest multiarch"
    echo "  $0 pull ${DOCKER_USERNAME}/${DOCKER_REPO}:latest"
    echo ""
    # Source .env file to get ports
    if [ -f "$ENV_FILE" ]; then
        source "$ENV_FILE"
    fi

    echo "Application Access:"
    echo "  App: http://localhost:${PORT:-3737}"
}

# Start services
start_services() {
    # Source .env file to get ports
    if [ -f "$ENV_FILE" ]; then
        source "$ENV_FILE"
    fi

    print_status "Starting ${APP_NAME} stack..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

    if [ $? -eq 0 ]; then
        print_success "Application stack started successfully!"
        print_status "App: http://localhost:${PORT:-3737}"
        print_status "Use 'docker compose -f $COMPOSE_FILE logs -f' to follow logs"
    else
        print_error "Failed to start application stack"
        exit 1
    fi
}

# Stop services
stop_services() {
    print_status "Stopping ${APP_NAME} stack..."
    docker compose -f "$COMPOSE_FILE" down

    if [ $? -eq 0 ]; then
        print_success "Application stack stopped successfully!"
    else
        print_error "Failed to stop application stack"
        exit 1
    fi
}

# Restart services
restart_services() {
    print_status "Restarting ${APP_NAME} stack..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart

    if [ $? -eq 0 ]; then
        print_success "Application stack restarted successfully!"
    else
        print_error "Failed to restart application stack"
        exit 1
    fi
}

# Show logs
show_logs() {
    print_status "Showing logs from all services..."
    docker compose -f "$COMPOSE_FILE" logs -f
}

# Show status
show_status() {
    print_status "Application stack status:"
    docker compose -f "$COMPOSE_FILE" ps
}

# Build application
build_app() {
    local platform_arg="$1"
    local platform=$(parse_platform "$platform_arg")

    if [ -n "$platform" ]; then
        print_status "Building ${APP_NAME} for platform: $platform"
        if [[ "$platform" == *","* ]]; then
            # Multi-platform build
            print_status "Building multi-platform image..."
            docker buildx build --network=host --platform "$platform" --no-cache -t ${DOCKER_IMAGE_NAME} .
        else
            # Single platform build - use buildx instead of docker compose
            docker buildx build --network=host --platform "$platform" --no-cache -t ${DOCKER_IMAGE_NAME} .
        fi
    else
        print_status "Building ${APP_NAME} (default platform)..."
        docker compose -f "$COMPOSE_FILE" build --no-cache --network=host
    fi

    if [ $? -eq 0 ]; then
        if [ -n "$platform" ]; then
            print_success "Application built successfully for platform: $platform"
        else
            print_success "Application built successfully!"
        fi
    else
        print_error "Failed to build application"
        exit 1
    fi
}

# Rebuild services
rebuild_services() {
    local platform_arg="$1"
    local platform=$(parse_platform "$platform_arg")

    # Source .env file to get ports
    if [ -f "$ENV_FILE" ]; then
        source "$ENV_FILE"
    fi

    if [ -n "$platform" ]; then
        print_status "Rebuilding and restarting application stack for platform: $platform"
        docker compose -f "$COMPOSE_FILE" down

        if [[ "$platform" == *","* ]]; then
            # Multi-platform build - build image first, then start services
            print_status "Building multi-platform image..."
            docker buildx build --network=host --platform "$platform" --no-cache -t ${DOCKER_IMAGE_NAME} .
            docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build
        else
            # Single platform build - build image first, then start services
            docker buildx build --network=host --platform "$platform" --no-cache -t ${DOCKER_IMAGE_NAME} .
            docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build
        fi
    else
        print_status "Rebuilding and restarting application stack (default platform)..."
        docker compose -f "$COMPOSE_FILE" down
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build --network=host
    fi

    if [ $? -eq 0 ]; then
        if [ -n "$platform" ]; then
            print_success "Application stack rebuilt and started successfully for platform: $platform"
        else
            print_success "Application stack rebuilt and started successfully!"
        fi
        print_status "App: http://localhost:${PORT:-3737}"
    else
        print_error "Failed to rebuild application stack"
        exit 1
    fi
}

# Push to Docker Hub
push_to_dockerhub() {
    local image_tag="$1"
    local platform_arg="$2"
    local platform=$(parse_platform "$platform_arg")

    if [ -z "$image_tag" ]; then
        print_error "Image tag is required for push command"
        print_status "Usage: $0 push <image_tag> [platform]"
        print_status "Examples:"
        print_status "  $0 push ${DOCKER_USERNAME}/${DOCKER_REPO}:latest"
        print_status "  $0 push ${DOCKER_USERNAME}/${DOCKER_REPO}:latest amd64"
        print_status "  $0 push ${DOCKER_USERNAME}/${DOCKER_REPO}:latest multiarch"
        exit 1
    fi

    if [ -n "$platform" ]; then
        print_status "Building, tagging and pushing $image_tag to Docker Hub for platform: $platform"
    else
        print_status "Building, tagging and pushing $image_tag to Docker Hub (default platform)..."
    fi

    # Step 1: Build the application image
    if [ -n "$platform" ]; then
        if [[ "$platform" == *","* ]]; then
            # Multi-platform build and push
            print_status "Step 1/2: Building and pushing multi-platform image..."
            docker buildx build --network=host --platform "$platform" --push -t "$image_tag" .

            if [ $? -eq 0 ]; then
                print_success "Successfully built and pushed multi-platform $image_tag to Docker Hub!"
                print_status "Platforms: $platform"
                print_status "You can now pull the image with: docker pull $image_tag"
                return 0
            else
                print_error "Failed to build and push multi-platform image"
                print_warning "Make sure you are logged in to Docker Hub: docker login"
                print_warning "And that buildx is set up: docker buildx create --use"
                exit 1
            fi
        else
            # Single platform build
            print_status "Step 1/3: Building application image for platform: $platform"
            docker buildx build --network=host --platform "$platform" --no-cache -t ${DOCKER_IMAGE_NAME} .
        fi
    else
        print_status "Step 1/3: Building application image (default platform)..."
        docker compose -f "$COMPOSE_FILE" build --no-cache --network=host app
    fi

    if [ $? -ne 0 ]; then
        print_error "Failed to build application image"
        exit 1
    fi

    print_success "Application image built successfully!"

    # Step 2: Tag the image
    print_status "Step 2/3: Tagging image as $image_tag..."
    local local_image="${DOCKER_IMAGE_NAME}"  # Docker compose creates this image name
    docker tag "${local_image}" "$image_tag"

    if [ $? -ne 0 ]; then
        print_error "Failed to tag image"
        exit 1
    fi

    print_success "Image tagged successfully!"

    # Step 3: Push to Docker Hub
    print_status "Step 3/3: Pushing $image_tag to Docker Hub..."
    docker push "$image_tag"

    if [ $? -eq 0 ]; then
        if [ -n "$platform" ]; then
            print_success "Successfully pushed $image_tag to Docker Hub for platform: $platform"
        else
            print_success "Successfully pushed $image_tag to Docker Hub!"
        fi
        print_status "You can now pull the image with: docker pull $image_tag"
    else
        print_error "Failed to push image to Docker Hub"
        print_warning "Make sure you are logged in to Docker Hub: docker login"
        exit 1
    fi
}

# Pull from Docker Hub
pull_from_dockerhub() {
    local image_tag="$1"

    if [ -z "$image_tag" ]; then
        print_error "Image tag is required for pull command"
        print_status "Usage: $0 pull <image_tag>"
        print_status "Examples:"
        print_status "  $0 pull ${DOCKER_USERNAME}/${DOCKER_REPO}:latest"
        print_status "  $0 pull username/${DOCKER_REPO}:v1.0"
        exit 1
    fi

    print_status "Pulling and replacing current image with $image_tag from Docker Hub..."

    # Step 1: Stop current services if running
    print_status "Step 1/3: Stopping current services (if running)..."
    docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
    print_success "Services stopped"

    # Step 2: Remove existing local image
    print_status "Step 2/3: Removing existing images..."
    docker rmi ${DOCKER_IMAGE_NAME} 2>/dev/null || print_warning "No existing ${DOCKER_IMAGE_NAME} image found"
    docker rmi "$image_tag" 2>/dev/null || print_warning "No existing $image_tag image found"

    # Step 3: Pull the new image from Docker Hub
    print_status "Step 3/3: Pulling $image_tag from Docker Hub..."
    docker pull "$image_tag"

    if [ $? -ne 0 ]; then
        print_error "Failed to pull image from Docker Hub"
        print_warning "Make sure the image exists and is accessible"
        exit 1
    fi

    print_success "Image pulled successfully!"
    print_success "Image $image_tag has been pulled and is ready to use"
}

# Main script logic
main() {
    # Check dependencies
    check_dependencies

    # Check and create .env file if needed
    check_env_file

    # Check uploads directory
    check_uploads_dir

    # Handle command
    case "${1:-help}" in
        up|start)
            start_services
            ;;
        down|stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        build)
            build_app "$2"
            ;;
        rebuild)
            rebuild_services "$2"
            ;;
        push)
            push_to_dockerhub "$2" "$3"
            ;;
        pull)
            pull_from_dockerhub "$2"
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            print_error "Unknown command: $1"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"