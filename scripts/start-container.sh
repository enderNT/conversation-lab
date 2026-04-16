#!/bin/sh

set -eu

DEFAULT_DATABASE_URL="file:/app/data/dev.db"

strip_wrapping_quotes() {
  value="$1"
  value=$(printf '%s' "$value" | sed -e 's/^"//' -e 's/"$//')
  value=$(printf '%s' "$value" | sed -e "s/^'//" -e "s/'$//")
  printf '%s' "$value"
}

normalize_database_url() {
  raw_value=$(strip_wrapping_quotes "$1")

  case "$raw_value" in
    file:*)
      path_part=$(strip_wrapping_quotes "${raw_value#file:}")

      case "$path_part" in
        "")
          printf '%s' "$DEFAULT_DATABASE_URL"
          ;;
        /*)
          printf 'file:%s' "$path_part"
          ;;
        *)
          file_name=$(basename "$path_part")

          if [ -z "$file_name" ] || [ "$file_name" = "." ] || [ "$file_name" = "/" ]; then
            file_name="dev.db"
          fi

          printf 'file:/app/data/%s' "$file_name"
          ;;
      esac
      ;;
    *)
      printf '%s' "$raw_value"
      ;;
  esac
}

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="$DEFAULT_DATABASE_URL"
else
  export DATABASE_URL=$(normalize_database_url "$DATABASE_URL")
fi

mkdir -p /app/data

bunx prisma db push
exec bun run start