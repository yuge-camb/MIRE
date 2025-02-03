# Mixed-Initiative Requirement Elicitation System

This project implements a mixed-initiative system designed to enhance the requirement elicitation process through real-time AI interventions. The system aims to improve requirement validability by focusing on understandability and consistency from the client's perspective.

## Project Overview

The system provides an interactive environment where users can input requirements while receiving targeted assistance from an AI system. Using a mixed-initiative approach, the system dynamically intervenes based on detected issues in requirement clarity and consistency.

![System Architecture](docs/figures/system_architecture.png)

The system follows a mixed-initiative architecture where AI interventions are triggered based on utility calculations from real-time analysis of user inputs.

### Example Interventions

<div style="display: flex; gap: 10px;">
    <img src="docs/figures/ambiguity_intervention.png" alt="Ambiguity intervention example" width="48%">
    <img src="docs/figures/consistency_intervention.png" alt="Consistency intervention example" width="48%">
</div>

The system provides two main types of interventions:
1. **Ambiguity Clarification**: Helps users specify their requirements more clearly when ambiguous phrases are detected
2. **Consistency Checking**: Identifies potential contradictions between different requirement statements

### Key Features

- Real-time analysis of requirement text
- Dynamic interventions for ambiguity and consistency issues
- Intelligent intervention timing based on utility calculations
- User feedback collection for intervention effectiveness
- Comprehensive logging of user interactions and system responses

## Development Stages

### Current Stage: Data Collection (data-collection branch)
- Collecting user feedback on interventions at different probability thresholds (p=0 and p=1)
- Gathering labeled data to infer utility function parameters
- Recording contextual parameters for u(A, G) and u(A, -G) calculations
- Building training dataset for intervention timing optimization

### Future Stage: System Evaluation (main branch)
- Implementation of fully integrated system
- Comparative evaluation of MI system versus fixed/no initiative approaches
- Analysis of requirement quality improvements
- User experience assessment

## System Architecture

The system processes individual answer segments through parallel LLM analysis for requirement quality issues. Intervention decisions are based on expected utility calculations:

```
eu(A | E) = p(G | E)u(A,G) + [1 - p(G | E)]u(A,¬G)

Where:
- eu(A | E): expected utility of intervening given user response
- p(G | E): probability an intervention is needed given response
- u(A,G): utility of intervening when needed
- u(A,¬G): utility of intervening when not needed
```

## Getting Started

### Prerequisites
- Node.js
- Python 3.8+
- FastAPI
- React

### Installation
1. Clone the repository
```bash
git clone https://github.com/yourusername/mixed-initiative-requirements.git
cd mixed-initiative-requirements
```

2. Install backend dependencies
```bash
cd backend
pip install -r requirements.txt
```

3. Install frontend dependencies
```bash
cd frontend
npm install
```

4. Start the development servers
```bash
# Backend
cd backend
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm run dev
```

## Contributing

This project is part of ongoing research into mixed-initiative systems and requirement engineering. If you're interested in contributing, please read our [contributing guidelines](CONTRIBUTING.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Models and Technical Implementation

### Understandability Detection
- Implemented using GPT-4
- Leverages established ambiguity types and definitions through crafted prompt templates
- Chosen due to lack of public labeled datasets for requirements ambiguity

### Consistency Detection
- Uses Natural Language Inference (NLI) approach
- Implements nli-deberta-v3-xsmall model
- Evaluates logical relationships between statement pairs (contradiction, entailment, neutral)
- Selected for robust performance on standard NLI benchmarks

## Acknowledgments

- Research supported by [Your Institution]
- Frontend framework: React with Tailwind CSS
- Backend: FastAPI and Python

## Contact

For questions or collaboration opportunities, please open an issue or contact [your contact information].