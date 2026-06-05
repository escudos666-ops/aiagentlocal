# Open WebUI Extensibility & Custom Integrations

## Plugin & Pipeline Architecture

Open WebUI allows extending functionality through:
1. **Pipelines** - Custom request/response processing
2. **Tools** - Expose external APIs and functions
3. **RAG (Retrieval-Augmented Generation)** - Custom document processing
4. **Front-end Plugins** - Custom UI components

## Custom Pipeline Example: Document Classification

```python
# pipelines/document_classifier.py
import json
from typing import Generator, Optional
from pydantic import BaseModel

class Pipeline:
    def __init__(self):
        self.name = "Document Classification Pipeline"
        self.valves = {
            "classification_model": "mistral",
            "confidence_threshold": 0.8,
        }

    async def on_startup(self):
        """Called when pipeline starts"""
        print(f"Loaded {self.name}")

    async def on_shutdown(self):
        """Called when pipeline stops"""
        print(f"Unloading {self.name}")

    def pipe(
        self, user_message: str, model_id: str, messages: list, body: dict
    ) -> Generator[str, None, None]:
        """
        Process user message through classification
        """
        # Step 1: Classify the incoming message
        classification_prompt = f"""Classify the following document into ONE of these categories:
        - Technical Documentation
        - Internal Policy
        - Financial Report
        - Customer Communication
        - Other

        Document: {user_message}
        
        Respond with ONLY the category name."""

        # Call the model
        classification_response = ""
        
        # For demo, we'll use a simple rule-based classifier
        keywords = {
            "Technical": ["API", "code", "function", "parameter", "return"],
            "Policy": ["policy", "procedure", "compliance", "requirement"],
            "Financial": ["revenue", "budget", "cost", "profit", "expense"],
            "Customer": ["customer", "client", "support", "issue"],
        }
        
        detected_category = "Other"
        for category, keywords_list in keywords.items():
            if any(kw.lower() in user_message.lower() for kw in keywords_list):
                detected_category = category
                break

        # Step 2: Augment messages with classification metadata
        augmented_messages = messages.copy()
        augmented_messages.append({
            "role": "system",
            "content": f"This message has been classified as: {detected_category}"
        })

        # Step 3: Add classification context to request body
        body["classification"] = {
            "category": detected_category,
            "confidence": 0.95,
        }

        # Step 4: Pass through to model with enhanced context
        # This would connect to your actual model endpoint
        yield f"[CLASSIFIED AS: {detected_category}]\n\n"
```

## Custom Tool Example: Database Query

```python
# tools/database_query.py
import asyncio
import json
from typing import Callable, Any

class Tools:
    def __init__(self):
        self.name = "Database Query Tool"
        self.valves = {
            "db_connection_string": "postgresql://user:pass@postgres:5432/openwebui",
            "allowed_queries": ["SELECT", "INSERT", "UPDATE"],
        }

    async def query_database(self, query: str, params: dict = None) -> dict:
        """Execute a database query safely"""
        import psycopg2
        
        # Security: Only allow predefined queries
        if not any(q in query.upper() for q in self.valves["allowed_queries"]):
            return {"error": "Query type not allowed"}
        
        try:
            conn = psycopg2.connect(self.valves["db_connection_string"])
            cursor = conn.cursor()
            cursor.execute(query, params or {})
            
            if cursor.description:
                columns = [desc[0] for desc in cursor.description]
                results = cursor.fetchall()
                return {
                    "success": True,
                    "columns": columns,
                    "rows": results,
                    "count": len(results)
                }
            else:
                conn.commit()
                return {"success": True, "rows_affected": cursor.rowcount}
        except Exception as e:
            return {"error": str(e)}
        finally:
            cursor.close()
            conn.close()

    def __call__(self, tool_name: str, tool_input: dict):
        """Handle tool invocation"""
        if tool_name == "query":
            return asyncio.run(self.query_database(
                tool_input.get("query"),
                tool_input.get("params")
            ))
```

## RAG Integration Example: Enterprise Knowledge Base

```python
# rag/enterprise_rag.py
import json
from typing import Generator
import requests

class RAG:
    def __init__(self):
        self.name = "Enterprise Knowledge Base RAG"
        self.valves = {
            "chroma_host": "chroma",
            "chroma_port": 8000,
            "collection_name": "enterprise_docs",
            "top_k": 5,
            "relevance_threshold": 0.7,
        }

    def retrieve_documents(self, query: str, user_id: str) -> list:
        """
        Retrieve relevant documents from Chroma
        considering user's department/access level
        """
        url = f"http://{self.valves['chroma_host']}:{self.valves['chroma_port']}/api/v1/collections/{self.valves['collection_name']}/query"
        
        response = requests.post(url, json={
            "query_texts": [query],
            "n_results": self.valves['top_k'],
            "where": {
                "$and": [
                    {"relevance": {"$gte": self.valves['relevance_threshold']}},
                    {"accessible_by": {"$in": ["public", user_id, "dept_all"]}}
                ]
            }
        })
        
        results = response.json()
        return results.get("documents", [[]])[0]

    def pipe(
        self, user_message: str, model_id: str, messages: list, body: dict
    ) -> Generator[str, None, None]:
        """
        Augment user query with retrieved documents
        """
        user_id = body.get("user_id", "anonymous")
        
        # Retrieve relevant documents
        documents = self.retrieve_documents(user_message, user_id)
        
        if documents:
            # Build context from retrieved documents
            context = "Relevant company information:\n\n"
            for i, doc in enumerate(documents, 1):
                context += f"{i}. {doc}\n"
            
            # Insert context into messages
            context_message = {
                "role": "system",
                "content": f"Use the following company context to answer the question:\n{context}"
            }
            
            # Insert before user message
            augmented_messages = messages[:-1] + [context_message] + [messages[-1]]
            body["messages"] = augmented_messages
            
            yield f"[Retrieved {len(documents)} relevant documents]\n"
```

## Webhook Integration Example: Slack Notifications

```python
# pipelines/slack_notifier.py
import requests
import asyncio
from datetime import datetime

class Pipeline:
    def __init__(self):
        self.name = "Slack Notification Pipeline"
        self.valves = {
            "slack_webhook_url": "${SLACK_WEBHOOK_URL}",
            "notify_on_error": True,
            "notify_on_long_inference": True,
            "long_inference_threshold_seconds": 30,
        }

    async def on_message_processed(self, message: dict, response: dict, processing_time: float):
        """
        Called after message is processed
        """
        notifications = []
        
        # Notify on errors
        if response.get("error") and self.valves["notify_on_error"]:
            notifications.append({
                "type": "error",
                "text": f"❌ Error processing message: {response['error']}"
            })
        
        # Notify on long inference
        if processing_time > self.valves["long_inference_threshold_seconds"]:
            notifications.append({
                "type": "warning",
                "text": f"⏱️ Long inference time: {processing_time:.1f}s"
            })
        
        # Send to Slack
        for notification in notifications:
            await self.send_slack_notification(notification)

    async def send_slack_notification(self, notification: dict):
        """Send notification to Slack"""
        payload = {
            "text": notification["text"],
            "username": "Open WebUI Bot",
            "icon_emoji": ":robot_face:",
            "attachments": [{
                "color": "danger" if notification["type"] == "error" else "warning",
                "ts": int(datetime.now().timestamp())
            }]
        }
        
        try:
            response = requests.post(
                self.valves["slack_webhook_url"],
                json=payload
            )
            response.raise_for_status()
        except Exception as e:
            print(f"Failed to send Slack notification: {e}")

    def pipe(self, user_message: str, model_id: str, messages: list, body: dict):
        """Pipeline processing"""
        # Regular pipeline processing
        yield "Processing with Slack notifications enabled..."
```

## N8N Workflow Integration

```json
{
  "name": "AI-Powered Document Processing",
  "nodes": [
    {
      "parameters": {
        "url": "http://openwebui:8080/api/chat/completions",
        "method": "POST",
        "headers": {
          "Authorization": "Bearer {{ $credentials.openwebui_api_key }}"
        },
        "body": {
          "model": "llama2",
          "messages": [
            {
              "role": "user",
              "content": "{{ $json.document_content }}"
            }
          ]
        }
      },
      "name": "Call Open WebUI",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [750, 320]
    },
    {
      "parameters": {
        "operations": "set",
        "fields": {
          "document_id": "={{ $json.id }}",
          "ai_analysis": "={{ $node['Call Open WebUI'].json.choices[0].message.content }}",
          "processed_at": "=new Date().toISOString()"
        }
      },
      "name": "Store in Database",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2,
      "position": [950, 320],
      "credentials": {
        "postgres": "{{ $credentials.postgres }}"
      }
    },
    {
      "parameters": {
        "chatId": "C123456",
        "text": "Document {{ $json.document_id }} analyzed:\n{{ $node['Call Open WebUI'].json.choices[0].message.content }}"
      },
      "name": "Notify Slack",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 2,
      "position": [950, 480],
      "credentials": {
        "slackApi": "{{ $credentials.slack }}"
      }
    }
  ],
  "connections": {
    "Call Open WebUI": {
      "main": [
        [
          {
            "node": "Store in Database",
            "type": "main",
            "index": 0
          },
          {
            "node": "Notify Slack",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## Temporal Workflow for Complex AI Tasks

```python
# temporal/ai_workflow.py
from datetime import timedelta
from temporalio import workflow, activity
from dataclasses import dataclass

@dataclass
class AITaskInput:
    documents: list[str]
    query: str
    model_id: str = "llama2"
    max_retries: int = 3

@activity.defn
async def extract_text_with_tika(document_url: str) -> str:
    """Extract text from document using Tika"""
    import requests
    response = requests.put(
        "http://tika:9998/tika",
        data=open(document_url, 'rb').read()
    )
    return response.text

@activity.defn
async def create_embeddings(text: str) -> list[float]:
    """Create embeddings using Ollama"""
    import requests
    response = requests.post(
        "http://ollama:11434/api/embeddings",
        json={
            "model": "nomic-embed-text",
            "prompt": text
        }
    )
    return response.json()["embedding"]

@activity.defn
async def query_openwebui(context: str, query: str, model_id: str) -> str:
    """Query Open WebUI with context"""
    import requests
    response = requests.post(
        "http://openwebui:8080/api/chat/completions",
        json={
            "model": model_id,
            "messages": [
                {
                    "role": "system",
                    "content": f"Context: {context}"
                },
                {
                    "role": "user",
                    "content": query
                }
            ]
        }
    )
    return response.json()["choices"][0]["message"]["content"]

@workflow.defn
class DocumentAnalysisWorkflow:
    @workflow.run
    async def run(self, input_data: AITaskInput) -> str:
        """
        Multi-step workflow:
        1. Extract text from all documents
        2. Create embeddings
        3. Query AI with context
        4. Return analysis
        """
        
        # Step 1: Extract text from documents in parallel
        extraction_tasks = [
            workflow.execute_activity(
                extract_text_with_tika,
                doc_url,
                start_to_close_timeout=timedelta(minutes=5),
                retry_policy=workflow.RetryPolicy(maximum_attempts=3)
            )
            for doc_url in input_data.documents
        ]
        
        extracted_texts = await asyncio.gather(*extraction_tasks)
        combined_text = "\n---\n".join(extracted_texts)
        
        # Step 2: Create embeddings
        embeddings = await workflow.execute_activity(
            create_embeddings,
            combined_text,
            start_to_close_timeout=timedelta(minutes=5)
        )
        
        # Step 3: Query with context
        analysis = await workflow.execute_activity(
            query_openwebui,
            combined_text,
            input_data.query,
            input_data.model_id,
            start_to_close_timeout=timedelta(minutes=10)
        )
        
        return analysis
```

## Deploying Custom Pipelines

```bash
# Copy your pipeline to the right location
mkdir -p ./config/webui/pipelines
cp pipelines/document_classifier.py ./config/webui/pipelines/

# Restart Open WebUI
docker-compose restart openwebui

# Check logs to confirm pipeline loaded
docker-compose logs openwebui | grep "Document Classification"
```

## Frontend Plugin Example: Custom Dashboard Widget

```javascript
// plugins/custom-dashboard-widget.js
export function CustomDashboardWidget() {
  return {
    name: "Enterprise Analytics Widget",
    component: (props) => {
      const [stats, setStats] = React.useState(null);

      React.useEffect(() => {
        // Fetch metrics from Prometheus
        fetch('http://prometheus:9090/api/v1/query?query=openwebui_request_count')
          .then(r => r.json())
          .then(data => setStats(data.data.result));
      }, []);

      return (
        <div style={{ padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <h2>Enterprise Metrics</h2>
          {stats ? (
            <div>
              {stats.map((metric, i) => (
                <div key={i}>
                  {metric.metric.job}: {metric.value[1]} requests
                </div>
              ))}
            </div>
          ) : (
            <p>Loading...</p>
          )}
        </div>
      );
    }
  };
}
```

## Best Practices

1. **Security**:
   - Store all credentials in Vault
   - Sanitize user inputs in all pipelines
   - Log access to sensitive data
   - Use TLS for all external connections

2. **Performance**:
   - Use caching for frequently retrieved data
   - Implement circuit breakers for external APIs
   - Set appropriate timeouts
   - Monitor resource usage

3. **Reliability**:
   - Implement retry logic with exponential backoff
   - Use Temporal for fault-tolerant workflows
   - Log all errors comprehensively
   - Set up alerting for failures

4. **Maintainability**:
   - Document all custom pipelines and tools
   - Use version control for plugins
   - Test extensively before production deployment
   - Monitor performance metrics
