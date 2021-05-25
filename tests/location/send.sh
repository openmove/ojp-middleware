#!/bin/bash
#
curl -X POST 'http://localhost:5000/ojp' -d @stop-location-template.xml --header "Content-Type:application/xml"

