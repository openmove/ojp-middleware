#!/bin/bash
#
curl -X POST 'http://localhost:3000/ojp' -d @stop-location-template.xml --header "Content-Type:application/xml"