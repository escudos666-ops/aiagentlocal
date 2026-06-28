"""
title: Agentics Router
author: Martin
version: 0.1
description: Call the local Agentics n8n automation router from Open WebUI.
"""

import requests


class Tools:
    def __init__(self):
        self.chat_url = "http://n8n:5678/webhook/agentics-chat"
        self.whatsapp_url = "http://n8n:5678/webhook/agentics-whatsapp-send"

    def ask_agentics_router(self, message: str) -> str:
        """
        Send a request to the local Agentics n8n router.
        Use this for local automation, Docker help, service checks, and assistant backend actions.
        """
        response = requests.post(
            self.chat_url,
            json={
                "message": message,
                "model": "agentics-assistant:latest",
                "temperature": 0.4,
                "num_ctx": 4096,
                "num_predict": 512,
            },
            timeout=120,
        )
        response.raise_for_status()
        return response.text

    def send_whatsapp_message(self, chat_id: str, text: str, session: str = "default") -> str:
        """
        Send a WhatsApp message through WAHA using n8n.
        chat_id usually looks like: 31612345678@c.us
        """
        response = requests.post(
            self.whatsapp_url,
            json={
                "session": session,
                "chatId": chat_id,
                "text": text,
            },
            timeout=60,
        )
        response.raise_for_status()
        return response.text
