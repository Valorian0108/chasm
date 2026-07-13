from concurrent.futures import ThreadPoolExecutor

from agents.planner import analyze as planner_analyze
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


def analyze_token(request):
    print("\n🧠 Coordinator received request...\n")

    agents_needed = planner_analyze(request)
    print("Planner selected:", agents_needed)

    report = {}
    token = request

    with ThreadPoolExecutor() as executor:
        futures = {}

        # Start all requested agents
        for agent_name in agents_needed:
            if agent_name in AGENTS:
                futures[agent_name] = executor.submit(
                    AGENTS[agent_name],
                    token
                )

        # Collect their results
        for agent_name, future in futures.items():
            result = future.result()
            report[agent_name] = result
            print(f"✅ {agent_name.title()} Agent finished.")
            if result.get("next_agents"):
                print(
                    f"🤖 {agent_name.title()} Agent requested: "
                    f"{result['next_agents']}"
                )

    decision = decision_analyze(report)
    report["decision"] = decision

    return report