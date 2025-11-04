$body = @{ jsonrpc = "2.0"; id = 1; method = "mcp.server.capabilities" }
$bodyJson = $body | ConvertTo-Json -Compress
$response = Invoke-RestMethod -Uri 'http://localhost:3000/_next/mcp' -Method Post -ContentType 'application/json' -Body $bodyJson
$response | ConvertTo-Json -Depth 6
