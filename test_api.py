import requests
try:
    res = requests.get('http://localhost:8000/api/v1/stats')
    print(res.status_code)
    print(res.text[:500])
except Exception as e:
    print(e)
