from dataclasses import dataclass


@dataclass
class Evidence:

    department: str

    title: str

    value: str

    level: str = "info"