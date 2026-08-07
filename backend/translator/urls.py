from django.urls import path

from .views import health, translate

urlpatterns = [
    path("health/", health, name="health"),
    path("translate/", translate, name="translate"),
]
