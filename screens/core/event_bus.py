from collections import deque


class EventBus:

    def __init__(self):

        self.events = deque()

    def publish(self, event):

        self.events.append(event)

    def consume(self):

        while self.events:

            yield self.events.popleft()