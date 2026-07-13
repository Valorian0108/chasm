from coordinator_v2 import analyze_token
from report import display

token = input("Enter token: ")

report = analyze_token(token)
print("\nEVENTS\n")

for event in report["events"]:
    print(event)

display(report)