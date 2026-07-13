STAGES = [

    "Planner",

    "Risk Office",

    "Community Intelligence",

    "Research Desk",

    "Investment Committee",

]


def advance(mission):

    if mission["state"] == "MISSION_LAUNCH":

        mission["stage"] += 1

        mission["progress"] = min(mission["stage"] * 20, 100)

        if mission["stage"] >= len(STAGES):

            mission["state"] = "REPORT_READY"

        return mission

    return mission