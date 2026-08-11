from django.urls import path

from .views import glossary, health, issue_session, revoke_session, translate

urlpatterns = [
    path("health/", health, name="health"),
    path("glossary/", glossary, name="glossary"),
    path("translate/", translate, name="translate"),
    path("auth/session/", issue_session, name="auth-session"),
    path("auth/session/revoke/", revoke_session, name="auth-session-revoke"),
]
