from enum import Enum
from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator
from typing import Annotated


class Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class Register(Input):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: Annotated[str, StringConstraints(strip_whitespace=False)] = Field(
        min_length=10, max_length=128
    )


class Login(Input):
    email: EmailStr
    password: Annotated[str, StringConstraints(strip_whitespace=False)] = Field(
        min_length=1, max_length=128
    )


class ProjectInput(Input):
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=5000)


class Status(str, Enum):
    todo = "Todo"
    progress = "In Progress"
    done = "Done"


class Priority(str, Enum):
    low = "Low"
    medium = "Medium"
    high = "High"
    critical = "Critical"


class IssueInput(Input):
    title: str = Field(min_length=3, max_length=180)
    description: str = Field(default="", max_length=15000)
    status: Status = Status.todo
    priority: Priority = Priority.medium
    assigned_to: int | None = Field(default=None, gt=0)


class IssuePatch(Input):
    title: str | None = Field(default=None, min_length=3, max_length=180)
    description: str | None = Field(default=None, max_length=15000)
    status: Status | None = None
    priority: Priority | None = None
    assigned_to: int | None = Field(default=None, gt=0)

    @field_validator("title", "description", "status", "priority")
    @classmethod
    def reject_explicit_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null")
        return value


class CommentInput(Input):
    body: str = Field(min_length=1, max_length=5000)


class MemberInput(Input):
    email: EmailStr
