#!/bin/bash
set -euo pipefail

ios_directory="$(cd "$(dirname "$0")/.." && pwd)"
developer_directory="$(xcode-select -p)"
frameworks="$developer_directory/Library/Developer/Frameworks"

# CLT ships Testing.framework outside Swift's default framework search path.
if test -d "$frameworks/Testing.framework"; then
    exec swift test --package-path "$ios_directory" --disable-xctest \
        -Xswiftc -F -Xswiftc "$frameworks" \
        -Xlinker -F -Xlinker "$frameworks" \
        -Xlinker -rpath -Xlinker "$frameworks" \
        -Xlinker -rpath -Xlinker "$frameworks/../usr/lib" "$@"
fi

exec swift test --package-path "$ios_directory" --disable-xctest "$@"
