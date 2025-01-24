from typing import Optional, List
import time
from models.data_models import Intervention  
import uuid

class InterventionService:
    def __init__(self, logger):
        self.logger = logger
        self.interventions = {}  # {uuid: Intervention}

    def create_intervention(self, uuid: str, type: str, **kwargs) -> Intervention:
        intervention = Intervention(
                id=str(uuid.uuid4()),  # Unique intervention ID
                uuid=uuid,             # Segment UUID this intervention belongs to
                type=type,
                **kwargs
            )
        self.interventions[intervention.id] = intervention
        return intervention

    async def handle_intervention_response(self, intervention_id: str, response: str):
        if intervention_id in self.interventions:
            intervention = self.interventions[intervention_id]
            intervention.response = response
            intervention.response_time = time.time()
            self.logger.log({
                'event': 'intervention_response',
                'intervention': intervention.dict(),
                'timestamp': time.time()
            })