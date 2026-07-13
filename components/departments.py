from dataclasses import dataclass


@dataclass(frozen=True)
class Department:

    name: str

    icon: str

    color: str

    verb: str

    description: str


DEPARTMENTS = {

    "Planner": Department(
        name="Planner",
        icon="◈",
        color="info",
        verb="Planning",
        description="Coordinates the investigation.",
    ),

    "Risk Office": Department(
        name="Risk Office",
        icon="🛡",
        color="success",
        verb="Inspecting",
        description="Performs contract security analysis.",
    ),

    "Community Intelligence": Department(
        name="Community Intelligence",
        icon="◎",
        color="info",
        verb="Monitoring",
        description="Analyzes market conversations.",
    ),

    "Research Desk": Department(
        name="Research Desk",
        icon="▣",
        color="info",
        verb="Reviewing",
        description="Reads project documentation.",
    ),

    "On-Chain Lab": Department(
        name="On-Chain Lab",
        icon="⬢",
        color="warning",
        verb="Analyzing",
        description="Investigates blockchain activity.",
    ),

    "Investment Committee": Department(
        name="Investment Committee",
        icon="▲",
        color="success",
        verb="Evaluating",
        description="Produces the final recommendation.",
    ),
}