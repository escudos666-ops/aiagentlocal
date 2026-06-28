import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getAgents, sendAgentMessage } from '../lib/toolsApi';
import type { AgentSummary } from '../types/agentics';

interface ChatEntry {
  role: 'user' | 'agent' | 'system';
  content: string;
  model?: string;
}

const defaultPrompt = 'Say hello from my Agentics dashboard and confirm you are reachable.';

export function AgentChat() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [defaultModel, setDefaultModel] = useState('agentics-assistant:latest');
  const [selectedModel, setSelectedModel] = useState('agentics-assistant:latest');
  const [message, setMessage] = useState(defaultPrompt);
  const [chatLog, setChatLog] = useState<ChatEntry[]>([
    {
      role: 'system',
      content: 'Use this panel to talk to your local Ollama-backed agents through the Agentics Tools API.',
    },
  ]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    setLoadingAgents(true);
    setErrorMessage('');

    getAgents(controller.signal)
      .then((result) => {
        setAgents(result.agents ?? []);
        setDefaultModel(result.default_model || 'agentics-assistant:latest');
        const preferred = result.agents?.find((agent) => agent.name === result.default_model)?.name;
        setSelectedModel(preferred || result.agents?.[0]?.name || result.default_model || 'agentics-assistant:latest');

        if (!result.ok && result.error) {
          setErrorMessage(result.error);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setErrorMessage(error instanceof Error ? error.message : 'Could not load local agents.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingAgents(false);
      });

    return () => controller.abort();
  }, []);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.name === selectedModel),
    [agents, selectedModel],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    const controller = new AbortController();
    setSending(true);
    setErrorMessage('');
    setChatLog((current) => [...current, { role: 'user', content: trimmed, model: selectedModel }]);

    try {
      const result = await sendAgentMessage(
        {
          message: trimmed,
          model: selectedModel || defaultModel,
          temperature: 0.4,
          num_ctx: 4096,
          num_predict: 512,
        },
        controller.signal,
      );

      if (!result.ok) {
        throw new Error(result.error || `Agent call failed with status ${result.status ?? 'unknown'}`);
      }

      setChatLog((current) => [
        ...current,
        {
          role: 'agent',
          content: result.response || '(empty response)',
          model: result.model || selectedModel,
        },
      ]);
      setMessage('');
    } catch (error) {
      const rendered = error instanceof Error ? error.message : 'Could not talk to the selected agent.';
      setErrorMessage(rendered);
      setChatLog((current) => [...current, { role: 'system', content: `Agent call failed: ${rendered}` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="agent-chat" aria-label="Agent chat console">
      <div className="agent-chat-header">
        <div>
          <span className="eyebrow">Agent console</span>
          <h2>Talk to your local agents</h2>
          <p>
            Connected through <strong>Agentics Tools API</strong> → <strong>Ollama</strong>. Default agent:{' '}
            <code>{defaultModel}</code>
          </p>
        </div>
        <span className={`pill ${errorMessage ? 'pill-error' : 'pill-user-facing'}`}>
          {loadingAgents ? 'Loading agents' : errorMessage ? 'Needs attention' : `${agents.length} agents online`}
        </span>
      </div>

      <form className="agent-chat-form" onSubmit={submit}>
        <label className="control-field">
          <span>Agent/model</span>
          <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
            {agents.length === 0 ? <option value={selectedModel}>{selectedModel}</option> : null}
            {agents.map((agent) => (
              <option value={agent.name} key={agent.id || agent.name}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>

        <label className="control-field agent-message-field">
          <span>Message</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask an agent to check a service, summarize status, or run a local reasoning task..."
            rows={3}
          />
        </label>

        <button className="button button-primary" type="submit" disabled={sending || !message.trim()}>
          {sending ? 'Talking...' : 'Send to agent'}
        </button>
      </form>

      {selectedAgent ? (
        <p className="agent-chat-meta">
          Selected: {selectedAgent.description || selectedAgent.name}
          {selectedAgent.capabilities?.length ? ` · ${selectedAgent.capabilities.join(', ')}` : ''}
        </p>
      ) : null}

      {errorMessage ? <p className="agent-chat-error">{errorMessage}</p> : null}

      <div className="agent-chat-log" aria-live="polite">
        {chatLog.map((entry, index) => (
          <article className={`agent-message agent-message-${entry.role}`} key={`${entry.role}-${index}`}>
            <strong>{entry.role === 'agent' ? entry.model || 'Agent' : entry.role}</strong>
            <p>{entry.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}