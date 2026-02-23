from app.schemas import CamelModel

class Role(CamelModel):
    id: int
    code: str
    name: str
