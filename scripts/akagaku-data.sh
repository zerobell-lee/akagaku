#!/bin/bash

# Akagaku Data Management Script
# Usage: ./scripts/akagaku-data.sh [command] [options]

set -e

# Configuration
APP_NAME="Akagaku"
PROD_DIR="$HOME/Library/Application Support/$APP_NAME"
DEV_DIR="$HOME/Library/Application Support/$APP_NAME (development)"
BACKUP_DIR=".backup"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Get target directory based on environment
get_target_dir() {
    local env=$1
    if [ "$env" = "prod" ]; then
        echo "$PROD_DIR"
    else
        echo "$DEV_DIR"
    fi
}

# Command: backup
cmd_backup() {
    local env=${1:-dev}
    local target_dir=$(get_target_dir "$env")
    local user_data_dir="$target_dir/userData"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_path="$target_dir/$BACKUP_DIR/backup_$timestamp"

    if [ ! -d "$user_data_dir" ]; then
        log_error "userData directory not found: $user_data_dir"
        exit 1
    fi

    log_info "Creating backup from $env environment..."
    mkdir -p "$backup_path"

    # Backup entire userData directory
    cp -r "$user_data_dir" "$backup_path/"

    log_success "Backup created: $backup_path"
    echo "$backup_path"
}

# Command: restore
cmd_restore() {
    local env=${1:-dev}
    local backup_name=$2
    local target_dir=$(get_target_dir "$env")

    if [ -z "$backup_name" ]; then
        log_error "Please specify backup name"
        cmd_list_backups "$env"
        exit 1
    fi

    local backup_path="$target_dir/$BACKUP_DIR/$backup_name"

    if [ ! -d "$backup_path" ]; then
        log_error "Backup not found: $backup_path"
        exit 1
    fi

    log_warning "This will overwrite current data in $env environment"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi

    log_info "Restoring from backup: $backup_name"

    # Remove existing userData directory
    if [ -d "$target_dir/userData" ]; then
        rm -rf "$target_dir/userData"
    fi

    # Restore userData directory from backup
    if [ -d "$backup_path/userData" ]; then
        cp -r "$backup_path/userData" "$target_dir/"
        log_success "Restored: userData directory"
    else
        log_error "No userData directory in backup"
        exit 1
    fi

    log_success "Restore completed"
}

# Command: list backups
cmd_list_backups() {
    local env=${1:-dev}
    local target_dir=$(get_target_dir "$env")
    local backup_dir="$target_dir/$BACKUP_DIR"

    if [ ! -d "$backup_dir" ]; then
        log_warning "No backups found"
        exit 0
    fi

    log_info "Available backups in $env environment:"
    echo
    ls -lht "$backup_dir" | grep "^d" | awk '{print $9, "(" $6, $7, $8 ")"}'
}

# Command: clean
cmd_clean() {
    local env=${1:-dev}
    local keep=${2:-5}
    local target_dir=$(get_target_dir "$env")
    local backup_dir="$target_dir/$BACKUP_DIR"

    if [ ! -d "$backup_dir" ]; then
        log_warning "No backups to clean"
        exit 0
    fi

    log_info "Keeping $keep most recent backups, deleting older ones..."

    local count=0
    ls -t "$backup_dir" | while read backup; do
        count=$((count + 1))
        if [ $count -gt $keep ]; then
            rm -rf "$backup_dir/$backup"
            log_success "Deleted: $backup"
        fi
    done

    log_success "Cleanup completed"
}

# Command: switch (copy data between environments)
cmd_switch() {
    local from=$1
    local to=$2

    if [ -z "$from" ] || [ -z "$to" ]; then
        log_error "Usage: switch <from> <to>"
        log_info "Example: switch dev prod"
        exit 1
    fi

    local from_dir=$(get_target_dir "$from")
    local to_dir=$(get_target_dir "$to")

    if [ ! -d "$from_dir" ]; then
        log_error "Source directory not found: $from_dir"
        exit 1
    fi

    log_warning "This will copy data from $from to $to environment"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Switch cancelled"
        exit 0
    fi

    # Create backup of destination first
    log_info "Creating backup of destination ($to)..."
    cmd_backup "$to" > /dev/null

    log_info "Copying data from $from to $to..."
    mkdir -p "$to_dir"

    # Remove existing userData in destination
    if [ -d "$to_dir/userData" ]; then
        rm -rf "$to_dir/userData"
    fi

    # Copy userData directory
    if [ -d "$from_dir/userData" ]; then
        cp -r "$from_dir/userData" "$to_dir/"
        log_success "Copied: userData directory"
    else
        log_error "Source userData directory not found"
        exit 1
    fi

    log_success "Switch completed"
}

# Command: reset
cmd_reset() {
    local env=${1:-dev}
    local target_dir=$(get_target_dir "$env")

    log_warning "This will DELETE ALL DATA in $env environment"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Reset cancelled"
        exit 0
    fi

    # Create backup before reset
    log_info "Creating backup before reset..."
    cmd_backup "$env" > /dev/null

    log_info "Resetting $env environment..."

    # Remove userData directory
    if [ -d "$target_dir/userData" ]; then
        rm -rf "$target_dir/userData"
        log_success "Deleted: userData directory"
    fi

    log_success "Reset completed"
}

# Command: info
cmd_info() {
    local env=${1:-dev}
    local target_dir=$(get_target_dir "$env")

    log_info "Environment: $env"
    log_info "Directory: $target_dir"
    echo

    if [ ! -d "$target_dir/userData" ]; then
        log_warning "userData directory does not exist"
        exit 0
    fi

    echo "userData directory:"
    local user_data_dir="$target_dir/userData"
    if [ -d "$user_data_dir" ]; then
        local size=$(du -sh "$user_data_dir" | cut -f1)
        echo "  Total size: $size"
        echo ""
        echo "  Files:"
        for file in "$user_data_dir"/*; do
            if [ -f "$file" ]; then
                local file_size=$(du -h "$file" | cut -f1)
                local date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$file")
                echo "    ✓ $(basename "$file") ($file_size, modified: $date)"
            fi
        done
    fi
}

# Main command dispatcher
main() {
    local command=$1
    shift

    case $command in
        backup)
            cmd_backup "$@"
            ;;
        restore)
            cmd_restore "$@"
            ;;
        list)
            cmd_list_backups "$@"
            ;;
        clean)
            cmd_clean "$@"
            ;;
        switch)
            cmd_switch "$@"
            ;;
        reset)
            cmd_reset "$@"
            ;;
        info)
            cmd_info "$@"
            ;;
        help|--help|-h|"")
            cat << EOF
Akagaku Data Management Script

Usage: ./scripts/akagaku-data.sh <command> [options]

Commands:
  backup [env]              Create backup of current data
                            env: prod|dev (default: dev)

  restore [env] <backup>    Restore from backup
                            env: prod|dev (default: dev)
                            backup: backup name (e.g., backup_20251003_220046)

  list [env]                List all available backups
                            env: prod|dev (default: dev)

  clean [env] [keep]        Clean old backups, keep N most recent
                            env: prod|dev (default: dev)
                            keep: number to keep (default: 5)

  switch <from> <to>        Copy data between environments
                            from/to: prod|dev

  reset [env]               Delete all data (creates backup first)
                            env: prod|dev (default: dev)

  info [env]                Show environment information
                            env: prod|dev (default: dev)

  help                      Show this help message

Examples:
  ./scripts/akagaku-data.sh backup dev
  ./scripts/akagaku-data.sh restore dev backup_20251003_220046
  ./scripts/akagaku-data.sh list dev
  ./scripts/akagaku-data.sh switch dev prod
  ./scripts/akagaku-data.sh info dev

EOF
            ;;
        *)
            log_error "Unknown command: $command"
            log_info "Run './scripts/akagaku-data.sh help' for usage"
            exit 1
            ;;
    esac
}

main "$@"
