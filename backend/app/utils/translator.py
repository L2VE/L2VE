"""
번역 유틸리티 - LLM을 사용한 효율적인 번역
"""
import os
import requests
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def translate_text_with_llm(text: str, provider: str = "groq", model: str = "qwen/qwen3-32b") -> str:
    """
    LLM을 사용하여 영어 텍스트를 한국어로 번역
    
    Args:
        text: 번역할 텍스트
        provider: LLM 제공자 (groq, openai)
        model: 모델 이름
    
    Returns:
        번역된 한국어 텍스트 (실패 시 원본 반환)
    """
    if not text or not text.strip():
        return text
    
    # 이미 한국어인지 간단히 체크 (한글 유니코드 범위)
    if any('\uAC00' <= char <= '\uD7A3' for char in text):
        return text  # 이미 한국어로 보이면 번역하지 않음
    
    try:
        if provider.lower() == "groq":
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                logger.warning("GROQ_API_KEY not found, skipping translation")
                return text
            
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            data = {
                "model": model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a professional translator. Translate the following English text to Korean. Only return the translated text, no explanations or additional text."
                    },
                    {
                        "role": "user",
                        "content": text
                    }
                ],
                "temperature": 0.3,
                "max_tokens": 2000
            }
            
            response = requests.post(url, json=data, headers=headers, timeout=10)
            if response.status_code == 200:
                result = response.json()
                translated = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                if translated:
                    return translated
            else:
                logger.warning(f"Translation API error: {response.status_code} - {response.text}")
        
        elif provider.lower() == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.warning("OPENAI_API_KEY not found, skipping translation")
                return text
            
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            data = {
                "model": model if "/" not in model else model.split("/")[-1],  # "openai/gpt-4" -> "gpt-4"
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a professional translator. Translate the following English text to Korean. Only return the translated text, no explanations or additional text."
                    },
                    {
                        "role": "user",
                        "content": text
                    }
                ],
                "temperature": 0.3,
                "max_tokens": 2000
            }
            
            response = requests.post(url, json=data, headers=headers, timeout=10)
            if response.status_code == 200:
                result = response.json()
                translated = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                if translated:
                    return translated
            else:
                logger.warning(f"Translation API error: {response.status_code} - {response.text}")
    
    except Exception as e:
        logger.error(f"Translation failed: {str(e)}")
    
    return text  # 실패 시 원본 반환


def translate_vulnerability_data(vuln: Dict[str, Any], provider: str = "groq", model: str = "qwen/qwen3-32b", enable_translation: bool = True) -> Dict[str, Any]:
    """
    취약점 데이터의 주요 필드를 한국어로 번역
    
    Args:
        vuln: 취약점 딕셔너리
        provider: LLM 제공자
        model: 모델 이름
        enable_translation: 번역 활성화 여부 (환경변수로 제어 가능)
    
    Returns:
        번역된 취약점 딕셔너리
    """
    # 번역 비활성화 시 원본 반환
    if not enable_translation:
        return vuln
    
    # 환경변수로 번역 비활성화 가능
    if os.getenv("DISABLE_TRANSLATION", "false").lower() == "true":
        return vuln
    
    translated = vuln.copy()
    
    # 제목 번역
    if translated.get('vulnerability_title') or translated.get('title'):
        title = translated.get('vulnerability_title') or translated.get('title', '')
        if title:
            translated['vulnerability_title'] = translate_text_with_llm(title, provider, model)
            translated['title'] = translated['vulnerability_title']
    
    # 설명 번역
    if translated.get('description'):
        translated['description'] = translate_text_with_llm(translated['description'], provider, model)
    
    # recommendation 번역
    if translated.get('recommendation') and isinstance(translated['recommendation'], dict):
        rec = translated['recommendation'].copy()
        if rec.get('how_to_fix'):
            rec['how_to_fix'] = translate_text_with_llm(rec['how_to_fix'], provider, model)
        # code_example_fix는 코드이므로 번역하지 않음
        translated['recommendation'] = rec
    
    # proof_of_concept 번역
    if translated.get('proof_of_concept') and isinstance(translated['proof_of_concept'], dict):
        poc = translated['proof_of_concept'].copy()
        if poc.get('scenario'):
            poc['scenario'] = translate_text_with_llm(poc['scenario'], provider, model)
        # example은 코드/URL이므로 번역하지 않음
        translated['proof_of_concept'] = poc
    
    # taint_flow_analysis의 explanation 번역
    if translated.get('taint_flow_analysis') and isinstance(translated['taint_flow_analysis'], dict):
        taint = translated['taint_flow_analysis'].copy()
        for key in ['source', 'propagation', 'sink']:
            if key in taint and isinstance(taint[key], dict):
                if taint[key].get('explanation'):
                    taint[key]['explanation'] = translate_text_with_llm(taint[key]['explanation'], provider, model)
        translated['taint_flow_analysis'] = taint
    
    # patch 객체 번역
    if translated.get('patch') and isinstance(translated['patch'], dict):
        patch = translated['patch'].copy()
        if patch.get('summary'):
            patch['summary'] = translate_text_with_llm(patch['summary'], provider, model)
        if patch.get('steps') and isinstance(patch['steps'], list):
            patch['steps'] = [translate_text_with_llm(step, provider, model) if isinstance(step, str) else step 
                             for step in patch['steps']]
        # code_diff, code_context는 코드이므로 번역하지 않음
        translated['patch'] = patch
    
    return translated

