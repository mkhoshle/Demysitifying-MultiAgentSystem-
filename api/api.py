import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from flask import Flask, jsonify, request

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

if load_dotenv:
    load_dotenv()

app = Flask(__name__, static_folder='../build/client', static_url_path='/')


@app.after_request
def add_no_store_headers(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


def _env_int(name, default):
    try:
        return int(os.getenv(name) or default)
    except ValueError:
        return default


DEFAULT_STUDENT_ID = 'alex'
_llm_disabled_until = 0
_llm_last_error = None
_chat_jobs = {}
_chat_jobs_lock = Lock()
_chat_executor = ThreadPoolExecutor(max_workers=_env_int('CHAT_WORKERS', 4))
_chat_job_ttl_seconds = _env_int('CHAT_JOB_TTL_SECONDS', 600)

AGENT_INFO = [
    {
        'id': 'course',
        'num': 1,
        'name': 'Course Statistics Agent',
        'short': 'Academics',
        'description': 'Ingests subject scores, GPA trends, and exam metrics. Outputs the top 10 majors that match academic strengths.',
        'color': 'var(--agent-1)',
    },
    {
        'id': 'family',
        'num': 2,
        'name': 'Family Background Agent',
        'short': 'Context',
        'description': 'Models household income, parental education, and geography to surface schools that fit financial and logistical constraints.',
        'color': 'var(--agent-2)',
    },
    {
        'id': 'personality',
        'num': 3,
        'name': 'Personality & Hobbies Agent',
        'short': 'Self',
        'description': 'Reads MBTI, interests, and skill signals. Outputs schools whose culture and programs align with temperament.',
        'color': 'var(--agent-3)',
    },
    {
        'id': 'coordinator',
        'num': 4,
        'name': 'Coordinator Agent',
        'short': 'Consensus',
        'description': "Weighs every peripheral agent's prediction, resolves conflicts, and produces the final top 5 schools and majors.",
        'color': 'var(--agent-4)',
    },
]


STUDENT_CASES = {
    'alex': {
        'summary': {
            'id': 'alex',
            'name': 'Alex Chen',
            'avatarInitials': 'AC',
            'tagline': 'STEM systems thinker',
            'academicFocus': 'Computer science and engineering',
            'familyRegion': 'Pacific Northwest',
            'color': 'var(--agent-1)',
        },
        'profile': {
            'id': 'alex',
            'name': 'Alex Chen',
            'avatarInitials': 'AC',
            'scores': [
                {'subject': 'Mathematics', 'score': 94, 'percentile': 92},
                {'subject': 'Physics', 'score': 88, 'percentile': 85},
                {'subject': 'Chemistry', 'score': 91, 'percentile': 89},
                {'subject': 'English', 'score': 86, 'percentile': 78},
                {'subject': 'Computer Science', 'score': 97, 'percentile': 96},
            ],
            'family': {
                'incomeTier': 'Middle',
                'region': 'Pacific Northwest',
                'parentEducation': "Bachelor's (mother), Associate's (father)",
                'siblings': 1,
                'firstGen': False,
            },
            'personality': {
                'mbti': 'INTJ',
                'introvertScore': 72,
                'hobbies': ['Robotics club', 'Chess', 'Hiking', 'Open-source coding'],
                'strengths': ['Analytical thinking', 'Persistence', 'Systems design'],
                'weaknesses': ['Public speaking', 'Group collaboration'],
            },
        },
        'outputs': {
            'course': [
                'Computer Science',
                'Electrical Engineering',
                'Data Science',
                'Applied Mathematics',
                'Physics',
                'Mechanical Engineering',
                'Statistics',
                'Bioinformatics',
                'Economics',
                'Cognitive Science',
            ],
            'family': [
                'University of Washington',
                'Oregon State University',
                'Portland State University',
                'Western Washington University',
                'Washington State University',
                'University of Oregon',
                'Seattle University',
                'Gonzaga University',
                'Central Washington University',
                'Eastern Washington University',
            ],
            'personality': [
                'MIT',
                'Caltech',
                'Carnegie Mellon',
                'Georgia Tech',
                'Stanford',
                'UC Berkeley',
                'University of Michigan',
                'UIUC',
                'Cornell',
                'Princeton',
            ],
        },
        'consensus': {
            'schools': [
                {'name': 'University of Washington', 'score': 94},
                {'name': 'Georgia Tech', 'score': 91},
                {'name': 'Carnegie Mellon', 'score': 89},
                {'name': 'UC Berkeley', 'score': 87},
                {'name': 'University of Michigan', 'score': 85},
            ],
            'majors': [
                {'name': 'Computer Science', 'score': 96},
                {'name': 'Data Science', 'score': 92},
                {'name': 'Electrical Engineering', 'score': 88},
                {'name': 'Applied Mathematics', 'score': 84},
                {'name': 'Cognitive Science', 'score': 81},
            ],
        },
    },
    'maya': {
        'summary': {
            'id': 'maya',
            'name': 'Maya Rivera',
            'avatarInitials': 'MR',
            'tagline': 'Civic leadership builder',
            'academicFocus': 'Policy, writing, and social science',
            'familyRegion': 'Southwest',
            'color': 'var(--agent-2)',
        },
        'profile': {
            'id': 'maya',
            'name': 'Maya Rivera',
            'avatarInitials': 'MR',
            'scores': [
                {'subject': 'Mathematics', 'score': 78, 'percentile': 62},
                {'subject': 'Government', 'score': 96, 'percentile': 97},
                {'subject': 'English', 'score': 94, 'percentile': 93},
                {'subject': 'Spanish', 'score': 98, 'percentile': 99},
                {'subject': 'Biology', 'score': 84, 'percentile': 75},
            ],
            'family': {
                'incomeTier': 'Lower-middle',
                'region': 'Southwest',
                'parentEducation': 'High school diploma (mother), some college (father)',
                'siblings': 3,
                'firstGen': True,
            },
            'personality': {
                'mbti': 'ENFJ',
                'introvertScore': 28,
                'hobbies': ['Debate team', 'Community organizing', 'Bilingual tutoring', 'School newspaper'],
                'strengths': ['Public speaking', 'Empathy', 'Coalition building'],
                'weaknesses': ['Quantitative speed', 'Overcommitting'],
            },
        },
        'outputs': {
            'course': [
                'Public Policy',
                'Political Science',
                'Journalism',
                'Sociology',
                'Education',
                'Psychology',
                'International Relations',
                'Communications',
                'Public Health',
                'Economics',
            ],
            'family': [
                'Arizona State University',
                'University of Arizona',
                'University of New Mexico',
                'Northern Arizona University',
                'New Mexico State University',
                'UC Riverside',
                'San Diego State University',
                'University of Nevada, Las Vegas',
                'Cal State Long Beach',
                'Texas State University',
            ],
            'personality': [
                'Georgetown',
                'UCLA',
                'UC Berkeley',
                'Northwestern',
                'NYU',
                'University of Michigan',
                'Boston University',
                'George Washington University',
                'American University',
                'USC',
            ],
        },
        'consensus': {
            'schools': [
                {'name': 'Arizona State University', 'score': 93},
                {'name': 'UCLA', 'score': 90},
                {'name': 'Georgetown', 'score': 88},
                {'name': 'UC Berkeley', 'score': 86},
                {'name': 'University of Arizona', 'score': 84},
            ],
            'majors': [
                {'name': 'Public Policy', 'score': 95},
                {'name': 'Political Science', 'score': 92},
                {'name': 'Journalism', 'score': 88},
                {'name': 'Education', 'score': 85},
                {'name': 'International Relations', 'score': 82},
            ],
        },
    },
    'jordan': {
        'summary': {
            'id': 'jordan',
            'name': 'Jordan Brooks',
            'avatarInitials': 'JB',
            'tagline': 'Creative environmental designer',
            'academicFocus': 'Design, ecology, and communication',
            'familyRegion': 'Great Lakes',
            'color': 'var(--agent-3)',
        },
        'profile': {
            'id': 'jordan',
            'name': 'Jordan Brooks',
            'avatarInitials': 'JB',
            'scores': [
                {'subject': 'Visual Arts', 'score': 97, 'percentile': 98},
                {'subject': 'Environmental Science', 'score': 92, 'percentile': 90},
                {'subject': 'English', 'score': 89, 'percentile': 83},
                {'subject': 'Mathematics', 'score': 76, 'percentile': 58},
                {'subject': 'Computer Science', 'score': 82, 'percentile': 70},
            ],
            'family': {
                'incomeTier': 'Upper-middle',
                'region': 'Great Lakes',
                'parentEducation': "Master's (mother), Bachelor's (father)",
                'siblings': 0,
                'firstGen': False,
            },
            'personality': {
                'mbti': 'ENFP',
                'introvertScore': 35,
                'hobbies': ['Digital illustration', 'Trail restoration', 'Photography', 'Student design studio'],
                'strengths': ['Creative synthesis', 'Storytelling', 'Visual problem solving'],
                'weaknesses': ['Test pacing', 'Long-form memorization'],
            },
        },
        'outputs': {
            'course': [
                'UX Design',
                'Environmental Design',
                'Architecture',
                'Industrial Design',
                'Communications',
                'Marketing',
                'Environmental Studies',
                'Urban Planning',
                'Human-Computer Interaction',
                'Media Studies',
            ],
            'family': [
                'University of Wisconsin-Madison',
                'University of Minnesota',
                'Michigan State University',
                'University of Illinois Chicago',
                'Iowa State University',
                'Ohio State University',
                'DePaul University',
                'College for Creative Studies',
                'Milwaukee Institute of Art & Design',
                'University of Cincinnati',
            ],
            'personality': [
                'RISD',
                'Carnegie Mellon',
                'Northeastern',
                'Pratt Institute',
                'NYU',
                'University of Michigan',
                'Brown',
                'Parsons School of Design',
                'CalArts',
                'Georgia Tech',
            ],
        },
        'consensus': {
            'schools': [
                {'name': 'University of Wisconsin-Madison', 'score': 91},
                {'name': 'University of Minnesota', 'score': 89},
                {'name': 'RISD', 'score': 87},
                {'name': 'Northeastern', 'score': 84},
                {'name': 'University of Michigan', 'score': 82},
            ],
            'majors': [
                {'name': 'Environmental Design', 'score': 94},
                {'name': 'UX Design', 'score': 91},
                {'name': 'Architecture', 'score': 87},
                {'name': 'Urban Planning', 'score': 84},
                {'name': 'Communications', 'score': 80},
            ],
        },
    },
}


def _get_case(student_id=None):
    return STUDENT_CASES.get(student_id or DEFAULT_STUDENT_ID) or STUDENT_CASES[DEFAULT_STUDENT_ID]


def _selected_student_id_from_request():
    student_id = request.args.get('studentId')
    if student_id:
        return student_id

    if request.is_json:
        data = request.get_json(silent=True) or {}
        return data.get('studentId') or DEFAULT_STUDENT_ID

    return DEFAULT_STUDENT_ID


@app.errorhandler(404)
def not_found(e):
    from flask import request
    if request.path.startswith('/api/'):
        return {'error': 'Not found'}, 404
    return app.send_static_file('index.html')


@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/api/time')
def get_current_time():
    return {'time': time.time()}


@app.route('/api/health')
def health():
    retry_in = max(0, round(_llm_disabled_until - time.time()))
    return jsonify({
        'status': 'ok',
        'llmConfigured': bool(os.getenv('OPENAI_API_KEY') or os.getenv('LLM_API_KEY')),
        'llmEnabled': _llm_enabled(),
        'llmRetryInSeconds': retry_in,
        'lastLlmError': _llm_last_error,
    })


@app.route('/api/students')
def get_students():
    return jsonify([case['summary'] for case in STUDENT_CASES.values()])


@app.route('/api/profile')
def get_profile():
    return jsonify(_get_case(_selected_student_id_from_request())['profile'])


@app.route('/api/outputs')
def get_outputs():
    return jsonify(_get_case(_selected_student_id_from_request())['outputs'])


@app.route('/api/consensus')
def get_consensus():
    return jsonify(_get_case(_selected_student_id_from_request())['consensus'])


def _classify_chat_intent(message):
    lower = message.lower()

    if any(k in lower for k in ['my name', 'who am i', 'student name', 'what is the name']):
        return 'profile'
    if (
        any(k in lower for k in ['why', 'explain', 'reason', 'rationale'])
        and any(k in lower for k in ['recommend', 'top school', 'university of washington', 'washington', 'uw', 'school'])
    ):
        return 'school_reason'
    if any(k in lower for k in ['help', 'what can', 'how do', 'what should']):
        return 'help'
    if any(k in lower for k in ['all agent', 'agents', 'who are', 'list agent', 'network', 'system']):
        return 'agents'
    if any(k in lower for k in ['output', 'prediction', 'isolated', 'each agent', 'agent result']):
        return 'outputs'
    if any(k in lower for k in ['full', 'everything', 'complete', 'summary', 'report', 'overview']):
        return 'full'
    if any(k in lower for k in ['score', 'course', 'grade', 'academic', 'gpa', 'subject']):
        return 'scores'
    if any(k in lower for k in ['family', 'income', 'parent', 'sibling', 'background', 'demographic']):
        return 'family'
    if any(k in lower for k in ['personality', 'mbti', 'hobby', 'hobbies', 'introvert', 'strength', 'weakness']):
        return 'personality'
    if any(k in lower for k in ['backup', 'safety', 'affordable', 'nearby']):
        return 'insight'
    if any(k in lower for k in [
        'recommend', 'consensus', 'final', 'top school', 'top major',
        'university', 'college', 'major', 'school', 'decision', 'fit',
    ]):
        return 'consensus'
    return 'insight'


def _build_chat_reply(intent, case):
    profile = case['profile']
    outputs = case['outputs']
    consensus = case['consensus']

    if intent == 'profile':
        top_score = max(profile['scores'], key=lambda s: s['score'])
        return (
            f"Your selected student is {profile['name']}. The strongest recorded subject is "
            f"{top_score['subject']} with a score of {top_score['score']}, and the current "
            f"academic direction points toward {consensus['majors'][0]['name']} and adjacent programs."
        )

    if intent == 'school_reason':
        top_school = consensus['schools'][0]
        top_major = consensus['majors'][0]
        return (
            f"I recommend {top_school['name']} as the top school for {profile['name']} because it has the best "
            f"combined score ({top_school['score']}) across the agent network. Agent 1 sees a strong academic "
            f"match for {top_major['name']}; Agent 2 contributes the {profile['family']['region']} family and "
            "access context; Agent 3 contributes culture and personality signals. The Coordinator ranks it first "
            "because it is the strongest overall fit after combining those views."
        )

    if intent == 'outputs':
        return (
            "I've collected isolated predictions from Agents 1, 2, and 3 before consensus weighting. "
            f"Agent 1's first major is {outputs['course'][0]}, Agent 2's first school is {outputs['family'][0]}, "
            f"and Agent 3's first school is {outputs['personality'][0]}."
        )

    return CHAT_REPLIES[intent]


def _source_labels(intent, case):
    name = case['profile']['name']
    source_map = {
        'help': ['Coordinator capabilities'],
        'profile': [f'{name} profile', 'Derived academic signals'],
        'agents': ['Agent descriptions'],
        'outputs': [f'{name} agent output lists'],
        'scores': [f'{name} academic scores'],
        'family': [f'{name} family context'],
        'personality': [f'{name} personality profile'],
        'consensus': [f'{name} final consensus rankings'],
        'school_reason': [f'{name} profile', 'Agent outputs', 'Final consensus rankings'],
        'full': [f'{name} profile', 'Agent outputs', 'Final consensus rankings'],
        'insight': [f'{name} profile', 'Agent outputs', 'Final consensus rankings'],
    }
    return source_map.get(intent, source_map['insight'])


def _build_llm_context(case):
    profile = case['profile']
    consensus = case['consensus']
    strongest_score = max(profile['scores'], key=lambda s: s['score'])
    lowest_score = min(profile['scores'], key=lambda s: s['score'])
    return {
        'selected_student': profile,
        'selected_student_agent_outputs': case['outputs'],
        'selected_student_final_consensus': consensus,
        'available_students': [student_case['summary'] for student_case in STUDENT_CASES.values()],
        'agents': AGENT_INFO,
        'consensus_weights': {
            'academic_fit': '40%',
            'context_and_access': '25%',
            'personal_fit': '35%',
        },
        'derived_insights': {
            'strongest_subject': strongest_score,
            'lowest_subject': lowest_score,
            'top_school': consensus['schools'][0],
            'top_major': consensus['majors'][0],
        },
    }


def _llm_timeout_seconds():
    try:
        return float(os.getenv('LLM_TIMEOUT_SECONDS') or '10')
    except ValueError:
        return 10.0


def _llm_failure_cooldown_seconds():
    try:
        return float(os.getenv('LLM_FAILURE_COOLDOWN_SECONDS') or '60')
    except ValueError:
        return 60.0


def _llm_enabled():
    value = (os.getenv('LLM_ENABLED') or 'true').strip().lower()
    return value not in ['0', 'false', 'no', 'off']


def _run_llm_request_in_subprocess(api_url, api_key, payload, timeout):
    worker_code = r"""
import json
import os
import socket
import sys
import urllib.error
import urllib.request

request = json.loads(sys.stdin.read())
socket.setdefaulttimeout(request['timeout'])
api_request = urllib.request.Request(
    request['api_url'],
    data=json.dumps(request['payload']).encode('utf-8'),
    headers={
        'Authorization': f"Bearer {os.environ['LLM_WORKER_API_KEY']}",
        'Content-Type': 'application/json',
    },
    method='POST',
)

try:
    with urllib.request.urlopen(api_request, timeout=request['timeout']) as response:
        body = json.loads(response.read().decode('utf-8'))
    print(json.dumps({'ok': True, 'body': body}))
except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, OSError) as exc:
    print(json.dumps({'ok': False, 'error': str(exc)}))
"""
    worker_input = json.dumps({
        'api_url': api_url,
        'payload': payload,
        'timeout': timeout,
    })
    worker_env = {**os.environ, 'LLM_WORKER_API_KEY': api_key}
    hard_timeout = timeout + 2

    completed = subprocess.run(
        [sys.executable, '-c', worker_code],
        input=worker_input,
        text=True,
        capture_output=True,
        timeout=hard_timeout,
        env=worker_env,
    )

    if completed.returncode != 0:
        raise RuntimeError((completed.stderr or completed.stdout or 'LLM worker failed').strip())

    result = json.loads(completed.stdout)
    if not result.get('ok'):
        raise RuntimeError(result.get('error') or 'LLM worker failed')

    return result['body']


def _extract_request_api_key(data):
    api_key = (
        data.get('apiKey')
        or request.headers.get('X-LLM-API-Key')
        or ''
    ).strip()
    return api_key or None


def _call_llm(message, case, request_api_key=None):
    global _llm_disabled_until, _llm_last_error

    if not _llm_enabled():
        return None

    api_key = request_api_key or os.getenv('OPENAI_API_KEY') or os.getenv('LLM_API_KEY')
    if not api_key:
        return None
    if not request_api_key and time.time() < _llm_disabled_until:
        return None

    base_url = (os.getenv('OPENAI_BASE_URL') or os.getenv('LLM_BASE_URL') or 'https://api.openai.com/v1').rstrip('/')
    model = os.getenv('OPENAI_MODEL') or os.getenv('LLM_MODEL') or 'gpt-4o-mini'
    timeout = _llm_timeout_seconds()
    context = json.dumps(_build_llm_context(case), indent=2)
    payload = {
        'model': model,
        'messages': [
            {
                'role': 'system',
                'content': (
                    'You are the Coordinator Agent for a multi-agent college recommendation dashboard. '
                    'Use the provided JSON as source-of-truth when the user asks about the selected student, '
                    'agents, majors, schools, rankings, or recommendations. You may also answer general, '
                    'unrelated questions normally. If a general answer is not based on the app data, say so briefly. '
                    'Be concise, specific, and helpful.'
                ),
            },
            {
                'role': 'user',
                'content': f'Existing application data:\n{context}\n\nUser question: {message}',
            },
        ],
        'temperature': 0.35,
        'max_tokens': 600,
    }

    try:
        response_data = _run_llm_request_in_subprocess(
            f'{base_url}/chat/completions',
            api_key,
            payload,
            timeout,
        )
    except (subprocess.TimeoutExpired, RuntimeError, ValueError, OSError) as exc:
        _llm_last_error = str(exc)
        if not request_api_key:
            _llm_disabled_until = time.time() + _llm_failure_cooldown_seconds()
        app.logger.warning('LLM chat request failed: %s', exc)
        return None

    try:
        content = response_data['choices'][0]['message']['content'].strip()
        _llm_last_error = None
        _llm_disabled_until = 0
        return content
    except (KeyError, IndexError, TypeError):
        _llm_last_error = 'Unexpected LLM response shape'
        if not request_api_key:
            _llm_disabled_until = time.time() + _llm_failure_cooldown_seconds()
        app.logger.warning('LLM chat response had an unexpected shape')
        return None


def _find_named_item(message, items):
    lower = message.lower()
    for item in items:
        if item.lower() in lower:
            return item
    return None


def _build_school_insight(message, case):
    outputs = case['outputs']
    consensus = case['consensus']
    all_schools = (
        [s['name'] for s in consensus['schools']]
        + outputs['family']
        + outputs['personality']
    )
    school = _find_named_item(message, all_schools)
    if not school:
        return None

    consensus_school = next((s for s in consensus['schools'] if s['name'] == school), None)
    family_rank = outputs['family'].index(school) + 1 if school in outputs['family'] else None
    personality_rank = outputs['personality'].index(school) + 1 if school in outputs['personality'] else None

    details = []
    if consensus_school:
        details.append(f'it has a final consensus score of {consensus_school["score"]}')
    if family_rank:
        details.append(f'Agent 2 ranks it #{family_rank} for context and access')
    if personality_rank:
        details.append(f'Agent 3 ranks it #{personality_rank} for personality and culture fit')

    if details:
        return (
            f'{school} is in the recommendation data for {case["profile"]["name"]}: '
            + '; '.join(details)
            + '.'
        )

    return (
        f'{school} appears in the broader agent data for {case["profile"]["name"]}, but it is not in the final top-5 consensus list. '
        'That usually means it has some fit signals, but the coordinator ranked other schools higher after combining '
        'academic fit, context and access, and personal fit.'
    )


def _build_local_insight_reply(message, intent, case):
    profile = case['profile']
    outputs = case['outputs']
    consensus = case['consensus']
    lower = message.lower()

    if intent in CHAT_REPLIES or intent in ['profile', 'school_reason']:
        return _build_chat_reply(intent, case)

    school_reply = _build_school_insight(message, case)
    if school_reply:
        return school_reply

    if any(k in lower for k in ['improve', 'weak', 'weakness', 'growth', 'work on']):
        weakest_subject = min(profile['scores'], key=lambda s: s['score'])
        return (
            f'The clearest growth areas for {profile["name"]} are {", ".join(profile["personality"]["weaknesses"])}. '
            f'Academically, {weakest_subject["subject"]} is the lowest recorded score at {weakest_subject["score"]}, '
            'so that is the best place to improve if the goal is a stronger all-around profile.'
        )

    if any(k in lower for k in ['best major', 'major should', 'what major', 'study']):
        top_major = consensus['majors'][0]
        return (
            f'The strongest major fit for {profile["name"]} is {top_major["name"]} with a consensus score of {top_major["score"]}. '
            f'That matches the highest academic and personality signals for this selected student.'
        )

    if any(k in lower for k in ['backup', 'safety', 'affordable', 'nearby']):
        return (
            'The most practical nearby options from the family-context agent are '
            f'{", ".join(outputs["family"][:5])}. These are worth treating as access-conscious options '
            f'because {profile["name"]} is based in the {profile["family"]["region"]} with a '
            f'{profile["family"]["incomeTier"].lower()} income context.'
        )

    strongest_score = max(profile['scores'], key=lambda s: s['score'])
    return (
        f'I can answer from the loaded profile for {profile["name"]}. The biggest pattern is '
        f'{strongest_score["subject"]} at {strongest_score["score"]}; the top major is '
        f'{consensus["majors"][0]["name"]}; and the top school is {consensus["schools"][0]["name"]}. '
        'Add an LLM API key on the landing page for open-ended general questions.'
    )


def _answer_chat_question(message, intent, case, request_api_key=None):
    llm_reply = _call_llm(message, case, request_api_key)
    if llm_reply:
        return llm_reply, 'llm', _source_labels(intent, case)

    if request_api_key:
        detail = f' Last LLM error: {_llm_last_error}' if _llm_last_error else ''
        return (
            'I tried to use the provided LLM API key, but the LLM request failed, so I am using the local MAS fallback for now.'
            + detail,
            'local_insights',
            ['LLM request failed', *_source_labels(intent, case)],
        )

    if intent != 'insight':
        return _build_chat_reply(intent, case), 'local', _source_labels(intent, case)

    return _build_local_insight_reply(message, intent, case), 'local_insights', _source_labels(intent, case)


def _chat_job_payload(reply, intent, mode, sources, student_id):
    return {
        'reply': reply,
        'intent': intent,
        'agents': AGENT_INFO,
        'mode': mode,
        'sources': sources,
        'studentId': student_id,
    }


def _prune_chat_jobs(now=None):
    now = now or time.time()
    cutoff = now - _chat_job_ttl_seconds
    expired = [
        job_id for job_id, job in _chat_jobs.items()
        if job.get('createdAt', now) < cutoff
    ]
    for job_id in expired:
        del _chat_jobs[job_id]


def _update_chat_job(job_id, **updates):
    with _chat_jobs_lock:
        job = _chat_jobs.get(job_id)
        if not job:
            return
        job.update(updates)
        job['updatedAt'] = time.time()


def _run_chat_job(job_id, message, intent, student_id, request_api_key):
    _update_chat_job(job_id, status='running')
    try:
        case = _get_case(student_id)
        reply, mode, sources = _answer_chat_question(message, intent, case, request_api_key)
        _update_chat_job(
            job_id,
            status='done',
            result=_chat_job_payload(reply, intent, mode, sources, case['summary']['id']),
        )
    except Exception as exc:
        app.logger.exception('Chat job failed')
        _update_chat_job(job_id, status='error', error=str(exc))


CHAT_REPLIES = {
    'help': (
        "I'm the Coordinator. I can route your question to any agent and synthesize a final recommendation. "
        "Try asking about course scores, family background, personality, individual agent outputs, "
        "or type \"recommend\" for the full consensus."
    ),
    'agents': (
        "Here is the agent network: three specialist agents plus one coordinator. "
        "Each specialist owns one perspective on the selected student profile."
    ),
    'scores': (
        "Routing to Agent 1 (Course Statistics). Pulling the selected student's academic record and score percentiles."
    ),
    'family': (
        "Routing to Agent 2 (Family Background). Pulling household and demographic context."
    ),
    'personality': (
        "Routing to Agent 3 (Personality & Hobbies). Pulling MBTI, interests, and strength signals."
    ),
    'consensus': (
        "Dispatching Agents 1-3, receiving predictions, and weighting academic fit (40%), "
        "context & access (25%), and personal fit (35%). Here is the final consensus."
    ),
    'full': (
        "Compiling a full report: all agent roles, profile slices, isolated predictions, "
        "and the weighted consensus."
    ),
}


@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json(silent=True) or {}
    message = (data.get('message') or '').strip()

    if not message:
        return jsonify({'error': 'Message is required'}), 400

    student_id = data.get('studentId') or DEFAULT_STUDENT_ID
    case = _get_case(student_id)
    intent = _classify_chat_intent(message)
    request_api_key = _extract_request_api_key(data)
    job_id = uuid.uuid4().hex
    now = time.time()

    with _chat_jobs_lock:
        _prune_chat_jobs(now)
        _chat_jobs[job_id] = {
            'id': job_id,
            'status': 'pending',
            'intent': intent,
            'studentId': case['summary']['id'],
            'createdAt': now,
            'updatedAt': now,
        }

    _chat_executor.submit(_run_chat_job, job_id, message, intent, case['summary']['id'], request_api_key)
    return jsonify({
        'jobId': job_id,
        'status': 'pending',
        'intent': intent,
        'studentId': case['summary']['id'],
        'agents': AGENT_INFO,
    }), 202


@app.route('/api/chat/<job_id>', methods=['GET'])
def get_chat_job(job_id):
    with _chat_jobs_lock:
        _prune_chat_jobs()
        job = _chat_jobs.get(job_id)
        if not job:
            return jsonify({'error': 'Chat job not found'}), 404
        payload = dict(job)

    if payload['status'] == 'done':
        return jsonify({
            'jobId': job_id,
            'status': 'done',
            **payload['result'],
        })

    if payload['status'] == 'error':
        return jsonify({
            'jobId': job_id,
            'status': 'error',
            'intent': payload.get('intent'),
            'studentId': payload.get('studentId'),
            'agents': AGENT_INFO,
            'error': payload.get('error') or 'Chat job failed',
        }), 500

    return jsonify({
        'jobId': job_id,
        'status': payload['status'],
        'intent': payload.get('intent'),
        'studentId': payload.get('studentId'),
        'agents': AGENT_INFO,
    })
