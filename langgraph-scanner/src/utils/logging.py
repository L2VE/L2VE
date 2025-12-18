"""
Logging utilities for MCP and LLM communication
"""
import os
import json
from datetime import datetime
from pathlib import Path
from typing import Any


class CommunicationLogger:
    """Logger for MCP and LLM communications"""
    
    def __init__(self, project_title: str):
        """
        Initialize logger
        
        Args:
            project_title: Project title for log file naming
        """
        self.project_title = project_title
        self.log_dir = Path("logs")
        self.log_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file = self.log_dir / f"{project_title}_{timestamp}_communication.log"
        
        self.log_count = 0
        
        # Initialize log file
        with open(self.log_file, 'w', encoding='utf-8') as f:
            f.write(f"Communication Log for {project_title}\n")
            f.write(f"Started at: {datetime.now().isoformat()}\n")
            f.write("="*80 + "\n\n")
    
    def log_mcp_request(self, tool_name: str, input_data: dict):
        """Log MCP tool request"""
        self.log_count += 1
        
        log_entry = {
            "type": "MCP_REQUEST",
            "timestamp": datetime.now().isoformat(),
            "sequence": self.log_count,
            "tool_name": tool_name,
            "input": input_data
        }
        
        self._write_log(log_entry)
        
        print(f"\n{'='*80}")
        print(f"📤 MCP REQUEST #{self.log_count}")
        print(f"{'='*80}")
        print(f"Tool: {tool_name}")
        print(f"Input: {json.dumps(input_data, indent=2, ensure_ascii=False)}")
        print(f"{'='*80}\n")
    
    def log_mcp_response(self, tool_name: str, output_data):
        """Log MCP tool response"""
        
        log_entry = {
            "type": "MCP_RESPONSE",
            "timestamp": datetime.now().isoformat(),
            "sequence": self.log_count,
            "tool_name": tool_name,
            "output": str(output_data)[:10000]  # Limit to 10k chars
        }
        
        self._write_log(log_entry)
        
        print(f"\n{'='*80}")
        print(f"📥 MCP RESPONSE #{self.log_count}")
        print(f"{'='*80}")
        print(f"Tool: {tool_name}")
        print(f"Output length: {len(str(output_data))} chars")
        print(f"Output preview (first 500 chars):")
        print(str(output_data)[:500])
        if len(str(output_data)) > 500:
            print(f"... (truncated)")
        print(f"{'='*80}\n")
    
    def log_llm_request(self, model: str, messages: list, tools_count: int):
        """Log LLM request with messages and tool count"""
        
        # ✅ Safely extract message data (handle both dict and LangChain objects)
        safe_messages = []
        for msg in messages:
            if isinstance(msg, dict):
                # Already a dict
                content = msg.get("content", "")
                safe_messages.append({
                    "role": msg.get("role", "unknown"),
                    "content": content,
                    "content_preview": str(content)[:200]
                })
            else:
                # LangChain message object
                msg_type = type(msg).__name__
                
                # Map LangChain types to roles
                role_mapping = {
                    "SystemMessage": "system",
                    "HumanMessage": "user",
                    "AIMessage": "assistant",
                    "ToolMessage": "tool"
                }
                role = role_mapping.get(msg_type, "unknown")
                
                # Safe content extraction
                content = getattr(msg, 'content', '')
                content_preview = str(content)[:200] if content else ""
                
                safe_messages.append({
                    "role": role,
                    "content": content,
                    "content_preview": content_preview
                })
        
        # Write to log file
        self._write_log({
            "type": "LLM_REQUEST",
            "timestamp": datetime.now().isoformat(),
            "model": model,
            "messages": safe_messages,
            "tools_count": tools_count
        })
        
        # ✅ Console output with SAFE access
        print(f"\n💬 Sending {len(messages)} messages to agent")
        for i, safe_msg in enumerate(safe_messages, 1):
            role = safe_msg.get("role", "unknown")
            content = safe_msg.get("content", "")
            preview = safe_msg.get("content_preview", "")
            
            print(f"\n  Message {i} ({role}):")
            print(f"    Length: {len(str(content))} chars")
            print(f"    Preview: {preview}...")        
        # print(f"\n{'='*80}")
        # print(f"🤖 LLM REQUEST #{self.log_count}")
        # print(f"{'='*80}")
        # print(f"Model: {model}")
        # print(f"Tools bound: {tools_count}")
        # print(f"Messages: {len(safe_messages)}")
        # for i, msg in enumerate(safe_messages, 1):
        #     print(f"\n  Message {i} ({msg['role']}):")
        #     print(f"    Length: {len(msg['content'])} chars")
        #     print(f"    Preview: {msg['content'][:200]}...")
        # print(f"{'='*80}\n")
    
    def log_llm_response(self, response_content: str, full_response=None):
        """
        Log LLM response
        
        Args:
            response_content: Main response content (may be empty for tool calls)
            full_response: Full response object for debugging
        """
        
        # Try to extract more information from full response
        response_info = {
            "content": response_content[:10000] if response_content else "",  # Limit to 10k chars
        }
        
        # If full_response is provided, extract additional information
        if full_response:
            # Check for tool calls
            if hasattr(full_response, 'tool_calls') and full_response.tool_calls:
                response_info["tool_calls"] = [
                    {
                        "name": tc.get('name', 'unknown'),
                        "args": tc.get('args', {})
                    }
                    for tc in full_response.tool_calls
                ]
            
            # Check for additional_kwargs (contains raw LLM output)
            if hasattr(full_response, 'additional_kwargs'):
                response_info["additional_kwargs"] = str(full_response.additional_kwargs)[:5000]
            
            # Try to get full response as string
            if hasattr(full_response, 'model_dump'):
                try:
                    response_info["full_response"] = str(full_response.model_dump())[:10000]
                except:
                    response_info["full_response"] = str(full_response)[:10000]
            else:
                response_info["full_response"] = str(full_response)[:10000]
        
        log_entry = {
            "type": "LLM_RESPONSE",
            "timestamp": datetime.now().isoformat(),
            "sequence": self.log_count,
            "content_length": len(response_content) if response_content else 0,
            **response_info
        }
        
        self._write_log(log_entry)
        
        print(f"\n{'='*80}")
        print(f"✅ LLM RESPONSE #{self.log_count}")
        print(f"{'='*80}")
        print(f"Response length: {len(response_content) if response_content else 0} chars")
        
        if response_content:
            print(f"\nResponse preview (first 1000 chars):")
            print(response_content[:1000])
            if len(response_content) > 1000:
                print(f"... (truncated, total {len(response_content)} chars)")
        else:
            print(f"\n⚠️  Response content is empty")
            if full_response:
                print(f"\nFull response object preview (first 1000 chars):")
                print(str(full_response)[:1000])
        
        # Log tool calls if present
        if "tool_calls" in response_info:
            print(f"\n🔧 Tool calls: {len(response_info['tool_calls'])}")
            for tc in response_info['tool_calls']:
                print(f"  - {tc['name']}")
        
        print(f"{'='*80}\n")
    
    # def _write_log(self, log_entry: dict):
    #     """Write log entry to file"""
    #     with open(self.log_file, 'a', encoding='utf-8') as f:
    #         f.write(json.dumps(log_entry, indent=2, ensure_ascii=False))
    #         f.write("\n\n" + "="*80 + "\n\n")
    def _write_log(self, entry):
        """Write log entry to file"""
        if not self.log_file:
            return
        
        # ✅ If entry contains messages, ensure they're safe
        if "messages" in entry and isinstance(entry["messages"], list):
            safe_messages = []
            for msg in entry["messages"]:
                if isinstance(msg, dict):
                    # Already safe
                    safe_messages.append(msg)
                else:
                    # LangChain object - convert to safe dict
                    msg_type = type(msg).__name__
                    role_mapping = {
                        "SystemMessage": "system",
                        "HumanMessage": "user",
                        "AIMessage": "assistant",
                        "ToolMessage": "tool"
                    }
                    role = role_mapping.get(msg_type, "unknown")
                    content = getattr(msg, 'content', '')
                    
                    safe_messages.append({
                        "role": role,
                        "content_preview": str(content)[:200] if content else ""
                    })
            
            entry["messages"] = safe_messages
        
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(entry, ensure_ascii=False, indent=2) + '\n')
                f.write('='*80 + '\n\n')
        except Exception as e:
            print(f"Warning: Failed to write log: {e}")
    
    def get_log_file_path(self) -> str:
        """Get log file path"""
        return str(self.log_file.absolute())
    
    def log_error(self, function: str, error: Exception, traceback_str: str):
        """Log detailed error information"""
        self._write_log({
            "type": "ERROR",
            "timestamp": datetime.now().isoformat(),
            "function": function,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "traceback": traceback_str
        })


# Global logger instance (will be initialized in main)
_logger = None


def init_logger(project_title: str):
    """Initialize global logger"""
    global _logger
    _logger = CommunicationLogger(project_title)
    return _logger


def get_logger() -> CommunicationLogger:
    """Get global logger instance"""
    return _logger
