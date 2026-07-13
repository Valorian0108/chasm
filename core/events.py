"""Event models used to describe mission activity."""

from dataclasses import dataclass


@dataclass
class MissionEvent:
    """A timestamped update emitted by a mission department."""

    department: str
    status: str
    message: str
    timestamp: float
    title: str = ""
    progress: int = 0
    level: str = "info"


@dataclass(frozen=True)
class MissionEventUI:
    """Display-ready representation of a mission event."""

    icon: str
    color_class: str
    badge: str
    title: str
    subtitle: str
    timestamp: float | None
    department: str
    message: str


_LEVEL_PRESENTATION = {
    "info": ("i", "aegis-ui-status-badge--info", "INFO"),
    "success": ("+", "aegis-ui-status-badge--success", "SUCCESS"),
    "warning": ("!", "aegis-ui-status-badge--warning", "WARNING"),
    "error": ("x", "aegis-ui-status-badge--error", "ERROR"),
}
_DEPARTMENT_ICONS = {
    "Planner": "◈",
    "Risk Office": "🛡",
    "Community Intelligence": "◎",
    "Research Desk": "▣",
    "On-Chain Lab": "⬢",
    "Investment Committee": "▲",
}

def to_ui_event(event: MissionEvent) -> MissionEventUI:
    """Convert a mission event into a consistent UI-friendly object."""
    _, color_class, badge = _LEVEL_PRESENTATION.get(
        event.level.lower(),
        _LEVEL_PRESENTATION["info"],
    )
    status = event.status.replace("_", " ").strip().title()
    icon = _DEPARTMENT_ICONS.get(event.department, "◇")

    return MissionEventUI(
        icon=icon,
        color_class=color_class,
        badge=badge,
        title=event.title,
        subtitle=f"{event.department} - {status}",
        timestamp=event.timestamp,
        department=event.department,
        message=event.message,
    )
