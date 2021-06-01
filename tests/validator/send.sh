#!/bin/bash
#
curl -X POST -H "Content-Type: application/xml" \
	 -d @stop-location-template.xml \
	 http://localhost:5000/OJPLocationInformationRequest