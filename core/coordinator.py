"""Mission coordination primitives for Aegis."""

from collections.abc import Generator

from agents.risk import analyze as analyze_risk

from .events import MissionEvent
from .mission import Mission


class Coordinator:
    """Coordinates the stages of a token investigation.

    The risk stage uses the existing risk agent. The remaining stages remain
    simulated while the event-driven integration is developed.
    """

    _STAGES: tuple[tuple[str, str, str, int, str], ...] = (
        ("Planner", "Mission planned", "Mission initialized.", 10, "info"),
        (
            "Community Intelligence",
            "Community analyzed",
            "Community sentiment analyzed.",
            50,
            "info",
        ),
        (
            "Research Desk",
            "Research reviewed",
            "Project documentation reviewed.",
            70,
            "success",
        ),
        (
            "On-Chain Lab",
            "On-chain analysis complete",
            "Holder distribution analyzed.",
            85,
            "success",
        ),
        (
            "Investment Committee",
            "Recommendation ready",
            "Investment recommendation completed.",
            100,
            "success",
        ),
    )

    def __init__(self, mission: Mission) -> None:
        """Initialize a coordinator for the supplied mission."""
        self.mission = mission

    def run(self, token: str) -> Generator[MissionEvent, None, Mission]:
        """Yield investigation events, then return the completed mission."""
        self.mission.token = token

        for department, title, message, progress, level in self._STAGES:
            event = self.mission.add_event(
                department=department,
                status="complete",
                message=message,
                title=title,
                progress=progress,
                level=level,
            )
            yield event

            if department == "Planner":
                yield self.mission.add_event(
                    department="Risk Office",
                    status="running",
                    title="Risk analysis",
                    message="Inspecting smart contract...",
                    progress=20,
                    level="info",
                )

                risk_result = analyze_risk(token)
                if self.mission.report is None:
                    self.mission.report = {}
                self.mission.report["risk"] = risk_result
                  
                reasoning = risk_result.get("reasoning", [])

                for item in reasoning:

                  self.mission.add_evidence(
        department="Risk Office",
        title="Finding",
        value=item,
        level="success",
    )
    
                
                yield self.mission.add_event(
                    department="Risk Office",
                    status="complete",
                    title="Risk analysis complete",
                    message=str(risk_result.get("summary", "Risk analysis completed.")),
                    progress=30,
                    level="success",
                )

        return self.mission
