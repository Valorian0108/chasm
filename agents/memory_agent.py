import json
import os

MEMORY_FILE = "memory/history.json"


def load():

    if not os.path.exists(MEMORY_FILE):
        return {}

    with open(MEMORY_FILE, "r") as f:
        return json.load(f)


def save(memory):

    with open(MEMORY_FILE, "w") as f:
        json.dump(memory, f, indent=4)


def remember(token, report):

    memory = load()

    memory[token.upper()] = report

    save(memory)


def recall(token):

    memory = load()

    return memory.get(token.upper())