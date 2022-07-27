#!/bin/bash
#
VERSION=$(node -p -e "require('../../package.json').version");

echo $VERSION

docker exec db sh -c 'exec mongodump -d ojp --archive' > dumps/${VERSION}.archive