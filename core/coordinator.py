"""Mission coordination primitives for Aegis."""

from __future__ import annotations

from contextlib import redirect_stdout
from collections.abc import Generator
from importlib import import_module
from io import StringIO

from .events import MissionEvent
from .mission import Mission


class Coordinator:
    """Coordinates the departments in an Aegis token investigation."""

    _STAGES: tuple[dict[str, object], ...] = (
        {
            "key": "planner",
            "department": "Planner",
            "module": "agents.planner",
            "running_title": "Planning mission",
            "running_message": "Selecting the investigation path...",
            "running_progress": 5,
            "complete_title": "Mission planned",
            "complete_message": "Mission initialized.",
            "complete_progress": 10,
        },
        {
            "key": "risk",
            "department": "Risk Office",
            "module": "agents.risk",
            "running_title": "Risk analysis",
            "running_message": "Inspecting smart contract...",
            "running_progress": 20,
            "complete_title": "Risk analysis complete",
            "complete_message": "Risk review completed.",
            "complete_progress": 30,
        },
        {
            "key": "social",
            "department": "Community Intelligence",
            "module": "agents.social",
            "running_title": "Community analysis",
            "running_message": "Analyzing community sentiment...",
            "running_progress": 40,
            "complete_title": "Community analysis complete",
            "complete_message": "Community sentiment analyzed.",
            "complete_progress": 50,
        },
        {
            "key": "docs",
            "department": "Research Desk",
            "module": "agents.docs",
            "running_title": "Research review",
            "running_message": "Reviewing official project documentation...",
            "running_progress": 60,
            "complete_title": "Research reviewed",
            "complete_message": "Project documentation reviewed.",
            "complete_progress": 70,
        },
        {
            "key": "wallet",
            "department": "On-Chain Lab",
            "module": "agents.wallet",
            "running_title": "On-chain analysis",
            "running_message": "Checking liquidity and market activity...",
            "running_progress": 80,
            "complete_title": "On-chain analysis complete",
            "complete_message": "On-chain activity analyzed.",
            "complete_progress": 85,
        },
        {
            "key": "decision",
            "department": "Investment Committee",
            "running_title": "Investment review",
            "running_message": "Evaluating all collected evidence...",
            "running_progress": 95,
            "complete_title": "Recommendation ready",
            "complete_message": "Investment recommendation completed.",
            "complete_progress": 100,
        },
    )

    _COMPLETE_LEVELS: dict[str, str] = {
        "planner": "info",
        "risk": "success",
        "social": "success",
        "docs": "success",
        "wallet": "success",
        "decision": "success",
    }

    _ERROR_RESULTS: dict[str, dict[str, object]] = {
        "planner": {
            "summary": "Planner unavailable; continuing with the full investigation path.",
            "confidence": 0,
            "reasoning": ["Planner unavailable; defaulting to all departments."],
            "next_agents": ["risk", "social", "docs", "wallet"],
        },
        "risk": {
            "summary": "Risk analysis is temporarily unavailable.",
            "confidence": 0,
            "reasoning": ["Risk agent could not complete."],
            "next_agents": [],
        },
        "social": {
            "summary": "Community analysis is temporarily unavailable.",
            "confidence": 0,
            "reasoning": ["Community Intelligence could not complete."],
            "next_agents": [],
        },
        "docs": {
            "summary": "Documentation analysis is temporarily unavailable.",
            "confidence": 0,
            "reasoning": ["Research Desk could not complete."],
            "next_agents": [],
        },
        "wallet": {
            "summary": "On-chain analysis is temporarily unavailable.",
            "confidence": 0,
            "reasoning": ["On-Chain Lab could not complete."],
            "next_agents": [],
        },
        "decision": {
            "score": None,
            "recommendation": "UNAVAILABLE",
            "confidence": 0,
            "strengths": [],
            "weaknesses": ["Investment Committee could not complete."],
            "summary": "The Investment Committee could not generate a recommendation.",
        },
    }

    def __init__(self, mission: Mission) -> None:
        """Initialize a coordinator for the supplied mission."""
        self.mission = mission

    def run(self, token: str) -> Generator[MissionEvent, None, Mission]:
        """Yield investigation events, then return the completed mission."""
        self.mission.token = token

        for stage in self._STAGES:
            key = str(stage["key"])
            department = str(stage["department"])

            yield self.mission.add_event(
                department=department,
                status="running",
                title=str(stage["running_title"]),
                message=str(stage["running_message"]),
                progress=int(stage["running_progress"]),
                level="info",
            )

            result = self._run_stage(key, stage, token)
            self.mission.report[key] = result
            self._add_evidence(department, key, result)

            yield self.mission.add_event(
                department=department,
                status="complete",
                title=str(stage["complete_title"]),
                message=str(result.get("summary") or stage["complete_message"]),
                progress=int(stage["complete_progress"]),
                level=self._COMPLETE_LEVELS.get(key, "success"),
            )

        self.mission.completed = True
        return self.mission

    def _run_stage(
        self,
        key: str,
        stage: dict[str, object],
        token: str,
    ) -> dict[str, object]:
        """Execute one existing agent and normalize its result."""
        try:
            if key == "decision":
                result = self._call_decision_agent()
            else:
                result = self._call_token_agent(str(stage["module"]), token)

            return self._normalize_result(key, result)

        except Exception as error:
            result = dict(self._ERROR_RESULTS[key])
            result["error"] = str(error)
            return result

    def _call_token_agent(
        self,
        module_name: str,
        token: str,
    ) -> dict[str, object] | list[str]:
        """Import and call an existing token agent."""
        module = import_module(module_name)
        with redirect_stdout(StringIO()):
            return module.analyze(token)

    def _call_decision_agent(self) -> dict[str, object]:
        """Import and call the existing decision agent."""
        module = import_module("agents.decision_ai")
        with redirect_stdout(StringIO()):
            return module.analyze(self.mission.report)

    def _normalize_result(self, key: str, result: object) -> dict[str, object]:
        """Coerce existing agent outputs into report dictionaries."""
        if isinstance(result, dict):
            normalized = dict(result)
        elif isinstance(result, list):
            normalized = {
                "summary": "Planner selected the investigation departments.",
                "confidence": 1,
                "reasoning": [", ".join(str(item) for item in result)],
                "next_agents": result,
            }
        else:
            normalized = {
                "summary": str(result),
                "confidence": 0,
                "reasoning": [str(result)],
                "next_agents": [],
            }

        if key != "decision":
            normalized.setdefault("summary", "Analysis completed.")
            normalized.setdefault("reasoning", [])
            normalized.setdefault("confidence", 0)
            normalized.setdefault("next_agents", [])

        return normalized

    def _add_evidence(
        self,
        department: str,
        key: str,
        result: dict[str, object],
    ) -> None:
        """Convert agent output into Mission evidence entries."""
        evidence_items = self._evidence_items(result)

        if not evidence_items:
            evidence_items = [str(result.get("summary") or "Analysis completed.")]

        level = self._COMPLETE_LEVELS.get(key, "info")

        for item in evidence_items:
            self.mission.add_evidence(
                department=department,
                title="Finding",
                value=item,
                level=level,
            )

    def _evidence_items(self, result: dict[str, object]) -> list[str]:
        """Extract human-readable evidence from common agent result fields."""
        reasoning = result.get("reasoning", [])

        if isinstance(reasoning, list) and reasoning:
            return [str(item) for item in reasoning]

        strengths = result.get("strengths", [])
        weaknesses = result.get("weaknesses", [])
        items: list[str] = []

        if isinstance(strengths, list):
            items.extend(f"Strength: {item}" for item in strengths)

        if isinstance(weaknesses, list):
            items.extend(f"Risk: {item}" for item in weaknesses)

        return items
