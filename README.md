# MindBody NodeJS API

This package provides an API interface to the Mindbody SOAP API and well as enriching data via the website.

This package is used to download data from Mindbody and import into a Business Intelligence tool.

It's limited for my own use. If you are interested in using it open a ticket and I can add documentation.

docker run -e "TOKEN=$TOKEN" -e "MAX_CONCURRENT_SESSIONS=10" -e "PREBOOT_CHROME=true" -e "DEFAULT_LAUNCH_ARGS=[\"--window-size=1920,1080\"]" -e FUNCTION_ENABLE_INCOGNITO_MODE=true -e "PROXY_HOST=browserless.my-domain.com" -p 3000:3000 --restart always -d --name browserless browserless/chrome