#!/bin/bash
#
docker exec db sh -c 'exec mongodump -d ojp --archive' > ojp.archive