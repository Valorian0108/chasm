from concurrent.futures import ThreadPoolExecutor

from agents.ai_planner import analyze as planner_analyze
from agents.social import analyze as social_analyze
from agents.wallet import analyze as wallet_analyze
from agents.risk import analyze as risk_analyze
from agents.docs import analyze as docs_analyze
from agents.decision_ai import analyze as decision_analyze


AGENTS = {
    "social": social_analyze,
    "wallet": wallet_analyze,
    "risk": risk_analyze,
    "docs": docs_analyze,
}


DEPARTMENTS = {
    "risk": "Risk Office",
    "social": "Community Intelligence",
    "wallet": "On-Chain Lab",
    "docs": "Research Desk",
}


def analyze_token(token):

    print("\n🧠 Coordinator V2 started...\n")

    queue = planner_analyze(token)

    print("Initial queue:", queue)

    events = [
        {
            "department": "Planner",
            "status": "complete",
            "message": "Investigation initialized",
        }
    ]

    completed = set()

    report = {}

    while queue:

        current_batch = []

        while queue:

            agent = queue.pop(0)

            if agent not in completed:
                current_batch.append(agent)

        if not current_batch:
            break

        print(f"\n🚀 Launching: {current_batch}")

        with ThreadPoolExecutor() as executor:

            futures = {}

            # ------------------------
            # Agent Started
            # ------------------------

            for agent in current_batch:

                department = DEPARTMENTS.get(agent, agent.title())

                events.append(
                    {
                        "department": department,
                        "status": "running",
                        "message": f"{department} started",
                    }
                )

                futures[agent] = executor.submit(
                    AGENTS[agent],
                    token,
                )

            # ------------------------
            # Agent Finished
            # ------------------------

            for agent, future in futures.items():

                result = future.result()

                report[agent] = result

                completed.add(agent)

                department = DEPARTMENTS.get(agent, agent.title())

                print(f"✅ {department} finished")

                events.append(
                    {
                        "department": department,
                        "status": "complete",
                        "message": f"{department} completed",
                    }
                )

                for next_agent in result.get("next_agents", []):

                    if next_agent not in completed:

                        print(
                            f"🤖 {department} requested {next_agent.title()}"
                        )

                        queue.append(next_agent)

    # ------------------------
    # Investment Committee
    # ------------------------

    events.append(
        {
            "department": "Investment Committee",
            "status": "running",
            "message": "Evaluating all evidence",
        }
    )

    decision = decision_analyze(report)

    report["decision"] = decision

    events.append(
        {
            "department": "Investment Committee",
            "status": "complete",
            "message": "Final recommendation completed",
        }
    )

    remember(token, report)

    return {
        "events": events,
        "report": report,
    }


def remember(token, report):
    """
    Future memory store.
    """
    pass