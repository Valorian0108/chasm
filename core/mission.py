"""Mission state for an Aegis token investigation."""

from __future__ import annotations

from dataclasses import dataclass, field
from time import time

from .events import MissionEvent
from .evidence import Evidence


@dataclass
class Mission:
    """Tracks the state of an investigation."""

    token: str

    progress: int = 0

    current_department: str | None = None

    events: list[MissionEvent] = field(default_factory=list)

    evidence: list[Evidence] = field(default_factory=list)

    report: dict[str, object] = field(default_factory=dict)

    completed: bool = False

    def add_event(
        self,
        department: str,
        status: str,
        message: str,
        title: str = "",
        progress: int | None = None,
        level: str = "info",
    ) -> MissionEvent:

        event = MissionEvent(
            department=department,
            status=status,
            message=message,
            timestamp=time(),
            title=title,
            progress=self.progress if progress is None else progress,
            level=level,
        )

        self.events.append(event)

        self.current_department = department

        self.progress = event.progress

        return event

    def add_evidence(
        self,
        department: str,
        title: str,
        value: str,
        level: str = "info",
    ) -> Evidence:

        evidence = Evidence(
            department=department,
            title=title,
            value=value,
            level=level,
        )

        self.evidence.append(evidence)

        return evidence

    @property
    def latest_event(self) -> MissionEvent | None:

        if not self.events:
            return None

        return self.events[-1]

    @property
    def progress_percent(self) -> int:

        return max(0, min(self.progress, 100))