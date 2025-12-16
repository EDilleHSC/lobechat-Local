"""
Tool Loop Prevention System
Prevents infinite tool call loops by implementing system guards
"""

import os
import json
from typing import Dict, Any, Optional

class ToolLoopGuard:
    def __init__(self):
        self.last_tool_call = None
        self.last_args = None
        self.consecutive_calls = 0
        self.max_consecutive_calls = 3

    def normalize_path(self, path: str) -> str:
        """Normalize paths to prevent malformed path retries"""
        if path.startswith('\\"') and path.endswith('\\"'):
            path = path[1:-1]  # Remove surrounding quotes
        return os.path.normpath(path)

    def should_block_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> bool:
        """Check if this tool call should be blocked to prevent loops"""

        # Normalize paths in arguments
        normalized_args = {}
        for key, value in arguments.items():
            if isinstance(value, str) and ('\\' in value or '/' in value):
                normalized_args[key] = self.normalize_path(value)
            else:
                normalized_args[key] = value

        # Check for identical consecutive calls
        if (self.last_tool_call == tool_name and
            self.last_args == normalized_args):
            self.consecutive_calls += 1
            if self.consecutive_calls >= self.max_consecutive_calls:
                return True
        else:
            self.consecutive_calls = 1

        self.last_tool_call = tool_name
        self.last_args = normalized_args
        return False

    def format_tool_result(self, tool_name: str, result: Any) -> str:
        """Format tool results to prevent them from triggering new tool calls"""
        formatted_result = f"""[TOOL_RESULT_START]
{json.dumps(result, indent=2)}
[TOOL_RESULT_END]

Task complete. Do not call tools again unless explicitly instructed."""

        # Reset the loop counter after successful completion
        self.consecutive_calls = 0

        return formatted_result

    def check_if_request_satisfied(self, user_request: str, tool_result: Any) -> bool:
        """Check if the tool result satisfies the original user request"""

        # Simple heuristics - can be made more sophisticated
        request_lower = user_request.lower()

        if 'list' in request_lower and 'directory' in request_lower:
            # For directory listings, check if we got file/folder data
            if isinstance(tool_result, (list, dict)) and len(tool_result) > 0:
                return True

        elif 'read' in request_lower and 'file' in request_lower:
            # For file reads, check if we got content
            if isinstance(tool_result, str) and len(tool_result) > 0:
                return True

        # Default: assume the request is satisfied if we got a non-empty result
        return tool_result is not None and tool_result != ""

# Example usage in your agent loop
def process_tool_call(user_request: str, tool_name: str, arguments: Dict[str, Any], tool_result: Any):
    guard = ToolLoopGuard()

    # Check if we should block this call
    if guard.should_block_tool_call(tool_name, arguments):
        return "ERROR: Tool call blocked to prevent infinite loop"

    # Process the tool result
    if guard.check_if_request_satisfied(user_request, tool_result):
        return guard.format_tool_result(tool_name, tool_result)
    else:
        # Request not satisfied, allow another tool call
        return f"Tool result received but request not satisfied. Result: {tool_result}"

# Example for directory listing
if __name__ == "__main__":
    guard = ToolLoopGuard()

    # Simulate a directory listing request
    user_request = "list our inbox navi"
    tool_name = "list_directory"
    arguments = {"path": "D:\\05_AGENTS-AI\\01_PRODUCTION\\OPS_INTAKE_NAVI_v2.0\\inbox"}
    tool_result = ["inquiry_remote_work.txt", "test_file_001.txt", "urgent_ceo_meeting.txt"]

    # First call - should proceed
    result1 = process_tool_call(user_request, tool_name, arguments, tool_result)
    print("First call result:")
    print(result1)
    print()

    # Second identical call - should be blocked
    result2 = process_tool_call(user_request, tool_name, arguments, tool_result)
    print("Second call result (should be blocked):")
    print(result2)