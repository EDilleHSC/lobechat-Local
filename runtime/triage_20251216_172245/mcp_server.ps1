# PowerShell MCP Server
# Simpler alternative to Node.js/Python

param(
    [int]$Port = 3002
)

# Import required assemblies
Add-Type -AssemblyName System.Net
Add-Type -AssemblyName System.Web

# Allowed directories for security
$AllowedPaths = @(
    "D:\05_AGENTS-AI",
    "D:\01_SYSTEM-Core", 
    "D:\02_SOFTWARE-Tools\01_AI_MODELS"
)

function Test-PathAllowed {
    param([string]$Path)
    foreach ($allowed in $AllowedPaths) {
        if ($Path.StartsWith($allowed)) {
            return $true
        }
    }
    return $false
}

function Get-DirectoryListing {
    param([string]$Path)
    
    if (!(Test-Path $Path)) {
        return @{ error = "Directory not found" }
    }
    
    try {
        $items = Get-ChildItem $Path | ForEach-Object {
            @{
                name = $_.Name
                type = if ($_.PSIsContainer) { "directory" } else { "file" }
                path = $_.FullName
                size = $_.Length
                modified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
            }
        }
        return @{ items = $items }
    }
    catch {
        return @{ error = $_.Exception.Message }
    }
}

function Get-FileContent {
    param([string]$Path)
    
    if (!(Test-Path $Path) -or (Get-Item $Path).PSIsContainer) {
        return @{ error = "File not found" }
    }
    
    if (!(Test-PathAllowed $Path)) {
        return @{ error = "Access denied" }
    }
    
    try {
        $content = Get-Content $Path -Raw -Encoding UTF8
        return @{ content = $content }
    }
    catch {
        return @{ error = $_.Exception.Message }
    }
}

# Create HTTP listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
    Write-Host "🚀 VBoarder MCP Server running on port $Port"
    Write-Host "📁 Allowed directories:"
    $AllowedPaths | ForEach-Object { Write-Host "   $_" }
    Write-Host ""
    Write-Host "🔗 Configure LobeChat to use: http://localhost:$Port"
    Write-Host "🛠️  Available tools: list_directory, read_file"
    Write-Host ""
    Write-Host "Press Ctrl+C to stop the server"
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        Write-Host "📨 $($request.HttpMethod) $($request.Url.AbsolutePath)"
        
        $response.ContentType = "application/json"
        
        try {
            Write-Host "📨 $($request.HttpMethod) $($request.Url.AbsolutePath)"
            
            if ($request.HttpMethod -eq "GET") {
                if ($request.Url.AbsolutePath -eq "/health") {
                    $result = @{
                        jsonrpc = "2.0"
                        result = @{
                            status = "healthy"
                            server = "VBoarder MCP Server (PowerShell)"
                        }
                        id = $null
                    }
                }
                elseif ($request.Url.AbsolutePath.StartsWith("/files/")) {
                    $filePath = [System.Web.HttpUtility]::UrlDecode($request.Url.AbsolutePath.Substring(7))
                    $normalizedPath = [System.IO.Path]::GetFullPath($filePath)
                    
                    if (!(Test-PathAllowed $normalizedPath)) {
                        $result = @{
                            jsonrpc = "2.0"
                            error = @{
                                code = -32000
                                message = "Access denied"
                            }
                            id = $null
                        }
                    }
                    elseif (!(Test-Path $normalizedPath) -or (Get-Item $normalizedPath).PSIsContainer) {
                        $result = @{
                            jsonrpc = "2.0"
                            error = @{
                                code = -32000
                                message = "File not found"
                            }
                            id = $null
                        }
                    }
                    else {
                        $mimeType = "application/octet-stream"
                        $ext = [System.IO.Path]::GetExtension($normalizedPath).ToLower()
                        switch ($ext) {
                            ".txt" { $mimeType = "text/plain" }
                            ".md" { $mimeType = "text/markdown" }
                            ".json" { $mimeType = "application/json" }
                            ".html" { $mimeType = "text/html" }
                            ".css" { $mimeType = "text/css" }
                            ".js" { $mimeType = "application/javascript" }
                            ".jpg" { $mimeType = "image/jpeg" }
                            ".png" { $mimeType = "image/png" }
                            ".gif" { $mimeType = "image/gif" }
                            ".pdf" { $mimeType = "application/pdf" }
                        }
                        
                        $response.ContentType = $mimeType
                        $content = [System.IO.File]::ReadAllBytes($normalizedPath)
                        $response.ContentLength64 = $content.Length
                        $response.OutputStream.Write($content, 0, $content.Length)
                        $response.OutputStream.Close()
                        continue
                    }
                }
                else {
                    $result = @{
                        jsonrpc = "2.0"
                        error = @{
                            code = -32601
                            message = "Method not found"
                        }
                        id = $null
                    }
                }
            }
            elseif ($request.HttpMethod -eq "POST") {
                if ($request.Url.AbsolutePath -eq "/" -or $request.Url.AbsolutePath -eq "/tools") {
                    try {
                        $reader = New-Object System.IO.StreamReader($request.InputStream)
                        $body = $reader.ReadToEnd()
                        Write-Host "📨 Body: '$body'"
                        $data = ConvertFrom-Json $body
                        Write-Host "📨 Parsed successfully"
                    }
                    catch {
                        Write-Host "❌ JSON parse error: $($_.Exception.Message)"
                        $result = @{
                            jsonrpc = "2.0"
                            error = @{
                                code = -32700
                                message = "Parse error: $($_.Exception.Message)"
                            }
                            id = $null
                        }
                        $json = ConvertTo-Json $result -Depth 10
                        $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
                        $response.ContentLength64 = $buffer.Length
                        $response.OutputStream.Write($buffer, 0, $buffer.Length)
                        $response.OutputStream.Close()
                        continue
                    }
                    
                    # Prepare JSON-RPC response
                    $jsonRpcResponse = @{
                        jsonrpc = "2.0"
                        id = $data.id
                    }
                    
                    if ($data.method -eq "tools/list") {
                        $jsonRpcResponse.result = @{
                            tools = @(
                                @{
                                    name = "list_directory"
                                    description = "List files and directories in a path"
                                    inputSchema = @{
                                        type = "object"
                                        properties = @{
                                            path = @{ type = "string"; description = "Directory path to list" }
                                        }
                                        required = @("path")
                                    }
                                },
                                @{
                                    name = "read_file"
                                    description = "Read the contents of a text file"
                                    inputSchema = @{
                                        type = "object"
                                        properties = @{
                                            path = @{ type = "string"; description = "File path to read" }
                                        }
                                        required = @("path")
                                    }
                                }
                            )
                        }
                    }
                    elseif ($data.method -eq "tools/call") {
                        $toolName = $data.params.name
                        $args = $data.params.arguments
                        
                        if ($toolName -eq "list_directory") {
                            $toolResult = Get-DirectoryListing $args.path
                            $jsonRpcResponse.result = $toolResult
                        }
                        elseif ($toolName -eq "read_file") {
                            $toolResult = Get-FileContent $args.path
                            $jsonRpcResponse.result = $toolResult
                        }
                        else {
                            $jsonRpcResponse.error = @{
                                code = -32601
                                message = "Method not found"
                            }
                        }
                    }
                    else {
                        $jsonRpcResponse.error = @{
                            code = -32601
                            message = "Method not found"
                        }
                    }
                    
                    $result = $jsonRpcResponse
                }
                else {
                    $result = @{
                        jsonrpc = "2.0"
                        error = @{
                            code = -32601
                            message = "Method not found"
                        }
                        id = $null
                    }
                }
            }
            else {
                $result = @{
                    jsonrpc = "2.0"
                    error = @{
                        code = -32601
                        message = "Method not found"
                    }
                    id = $null
                }
            }
            
            $json = ConvertTo-Json $result -Depth 10
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        catch {
            Write-Host "❌ Error: $($_.Exception.Message)"
            $errorResult = @{
                jsonrpc = "2.0"
                error = @{
                    code = -32603
                    message = $_.Exception.Message
                }
                id = $null
            }
            $json = ConvertTo-Json $errorResult
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        
        $response.OutputStream.Close()
    }
}
catch {
    Write-Host "❌ Server error: $($_.Exception.Message)"
}
finally {
    if ($listener.IsListening) {
        $listener.Stop()
        Write-Host "👋 MCP Server stopped"
    }
}